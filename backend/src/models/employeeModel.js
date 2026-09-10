import { sql, poolPromise } from '../config/dbConfig.js';

// ─────────────────────────────────────────────
// Employees
// ─────────────────────────────────────────────

/**
 * Insere um funcionário. Retorna o ID gerado.
 */
export async function insertEmployee(transaction, {
    supplierId, laborRequestId, fullName, cpf, rg, roleFunction
}) {
    const request = new sql.Request(transaction);
    const result = await request
        .input('supplier_id', sql.Int, supplierId)
        .input('labor_request_id', sql.Int, laborRequestId)
        .input('full_name', sql.NVarChar(300), fullName)
        .input('cpf', sql.VarChar(14), cpf ?? null)
        .input('rg', sql.VarChar(20), rg ?? null)
        .input('role_function', sql.NVarChar(200), roleFunction ?? null)
        .query(`
            INSERT INTO employees (supplier_id, labor_request_id, full_name, cpf, rg, role_function, [status])
            OUTPUT INSERTED.id
            VALUES (@supplier_id, @labor_request_id, @full_name, @cpf, @rg, @role_function, 0)
        `);
    return result.recordset[0]?.id ?? null;
}

/**
 * Busca o id de um colaborador pelo CPF dentro de um fornecedor + solicitação.
 * Usado no fluxo "uma NR por vez" para reaproveitar o mesmo colaborador.
 * Retorna o id ou null.
 */
export async function getEmployeeIdByCpf(transaction, supplierId, laborRequestId, cpf) {
    const request = new sql.Request(transaction);
    const result = await request
        .input('supplier_id', sql.Int, supplierId)
        .input('labor_request_id', sql.Int, laborRequestId)
        .input('cpf', sql.VarChar(14), cpf ?? null)
        .query(`
            SELECT TOP 1 id
            FROM employees
            WHERE supplier_id = @supplier_id
              AND labor_request_id = @labor_request_id
              AND cpf = @cpf
            ORDER BY id ASC
        `);
    return result.recordset[0]?.id ?? null;
}

/**
 * Insere ou atualiza uma relação colaborador ↔ NR.
 */
export async function insertEmployeeNr(transaction, employeeId, nrTypeId, certificateDocId, expirationDate) {
    const request = new sql.Request(transaction);
    await request
        .input('employee_id', sql.Int, employeeId)
        .input('nr_type_id', sql.Int, nrTypeId)
        .input('certificate_doc_id', sql.Int, certificateDocId ?? null)
        .input('expiration_date', sql.Date, expirationDate ?? null)
        .query(`
            IF EXISTS (SELECT 1 FROM employee_nrs WHERE employee_id = @employee_id AND nr_type_id = @nr_type_id)
                UPDATE employee_nrs
                SET certificate_doc_id = @certificate_doc_id,
                    expiration_date    = @expiration_date
                WHERE employee_id = @employee_id AND nr_type_id = @nr_type_id
            ELSE
                INSERT INTO employee_nrs (employee_id, nr_type_id, certificate_doc_id, expiration_date)
                VALUES (@employee_id, @nr_type_id, @certificate_doc_id, @expiration_date)
        `);
}

/**
 * Lista os funcionários de um fornecedor em uma solicitação.
 */
export async function getEmployeesBySupplierAndRequest(supplierId, laborRequestId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('supplier_id', sql.Int, supplierId)
        .input('labor_request_id', sql.Int, laborRequestId)
        .query(`
            SELECT
                e.id,
                e.uid,
                e.full_name,
                e.cpf,
                e.rg,
                e.role_function,
                e.[status],
                e.created_at
            FROM employees AS e
            WHERE e.supplier_id      = @supplier_id
              AND e.labor_request_id = @labor_request_id
            ORDER BY e.full_name ASC
        `);

    const employees = result.recordset;

    // Para cada funcionário, busca suas NRs
    for (const emp of employees) {
        const nrResult = await pool.request()
            .input('employee_id', sql.Int, emp.id)
            .query(`
                SELECT en.nr_type_id, nt.code AS nr_code, nt.[name] AS nr_name, en.expiration_date
                FROM employee_nrs AS en
                INNER JOIN nr_types AS nt ON nt.id = en.nr_type_id
                WHERE en.employee_id = @employee_id
            `);
        emp.nrs = nrResult.recordset;
    }

    return employees;
}

/**
 * Lista todos os funcionários (painel interno).
 */
export async function getAllEmployees() {
    const pool = await poolPromise;
    const result = await pool.request()
        .query(`
            SELECT
                e.id,
                e.uid,
                e.full_name,
                e.cpf,
                e.role_function,
                e.[status],
                s.razao_social AS supplier_name,
                lr.title       AS labor_request_title
            FROM employees AS e
            INNER JOIN suppliers AS s    ON s.id  = e.supplier_id
            LEFT  JOIN labor_requests lr ON lr.id = e.labor_request_id
            ORDER BY e.created_at DESC
        `);
    return result.recordset;
}

/**
 * Atualiza o status de um funcionário.
 */
export async function updateEmployeeStatus(transaction, employeeId, status) {
    const request = new sql.Request(transaction);
    await request
        .input('id', sql.Int, employeeId)
        .input('status', sql.TinyInt, status)
        .query('UPDATE employees SET [status] = @status, updated_at = GETDATE() WHERE id = @id');
}

// ─────────────────────────────────────────────
// Documents
// ─────────────────────────────────────────────

/**
 * Registra um documento enviado no banco.
 * Retorna o ID gerado.
 */
export async function insertDocument(transaction, {
    supplierId, documentTypeId, laborRequestId, employeeId,
    fileName, filePath, fileSizeBytes, mimeType, fileHash, expiresAt
}) {
    const request = new sql.Request(transaction);
    const result = await request
        .input('supplier_id', sql.Int, supplierId)
        .input('document_type_id', sql.Int, documentTypeId)
        .input('labor_request_id', sql.Int, laborRequestId ?? null)
        .input('employee_id', sql.Int, employeeId ?? null)
        .input('file_name', sql.NVarChar(500), fileName)
        .input('file_path', sql.NVarChar(1000), filePath)
        .input('file_size_bytes', sql.BigInt, fileSizeBytes ?? null)
        .input('mime_type', sql.VarChar(100), mimeType ?? null)
        .input('file_hash', sql.VarChar(128), fileHash ?? null)
        .input('expires_at', sql.Date, expiresAt ?? null)
        .query(`
            INSERT INTO documents
                (supplier_id, document_type_id, labor_request_id, employee_id,
                 file_name, file_path, file_size_bytes, mime_type, file_hash,
                 [version], is_current, [status], expires_at)
            OUTPUT INSERTED.id
            VALUES
                (@supplier_id, @document_type_id, @labor_request_id, @employee_id,
                 @file_name, @file_path, @file_size_bytes, @mime_type, @file_hash,
                 1, 1, 0, @expires_at)
        `);
    return result.recordset[0]?.id ?? null;
}



/**
 * Lista os documentos de um fornecedor em uma solicitação.
 */
export async function getDocumentsBySupplierAndRequest(supplierId, laborRequestId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('supplier_id', sql.Int, supplierId)
        .input('labor_request_id', sql.Int, laborRequestId)
        .query(`
            SELECT
                d.id,
                d.uid,
                d.document_type_id,
                dt.[name]        AS document_type_name,
                dt.scope,
                d.employee_id,
                e.full_name      AS employee_name,
                d.file_name,
                d.file_size_bytes,
                d.mime_type,
                d.[status],
                d.expires_at,
                d.uploaded_at
            FROM documents AS d
            INNER JOIN document_types AS dt ON dt.id = d.document_type_id
            LEFT  JOIN employees      AS e  ON e.id  = d.employee_id
            WHERE d.supplier_id      = @supplier_id
              AND d.labor_request_id = @labor_request_id
              AND d.is_current       = 1
            ORDER BY d.uploaded_at DESC
        `);
    return result.recordset;
}
