// importando a configuração do banco de dados
import {sql, poolPromise} from '../config/dbConfig.js';

export async function laborRequestNew(transaction, id_user, activity_type_id, title, description, location, urgency, startDate) {
    const request = new sql.Request(transaction);
    const result = await request
        .input('id_user', sql.Int, id_user)
        .input('activity_type_id', sql.Int, activity_type_id)
        .input('title', sql.VarChar, title)
        .input('description', sql.VarChar, description)
        .input('location', sql.VarChar, location)
        .input('urgency', sql.TinyInt, urgency)
        .input('startDate', sql.DateTime2, startDate)
        .query('insert into labor_requests (requester_id, activity_type_id, title, [description], [location], start_date, urgency, [status], update_by_id) Output inserted.id VALUES (@id_user,@activity_type_id, @title, @description, @location, @startDate, @urgency, 0, @id_user)');

    return result.recordset[0];
}

export async function getLaborRequest(top = 10) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('top', sql.Int, top)
        .query('Select top (@top) r.id, u.[name], r.activity_type_id, r.[location], r.title, r.urgency, r.[status], r.created_at from labor_requests as r Inner join users as u on u.id = r.requester_id');

    return result.recordset;
}

export async function getLaborRequestById(id) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, id)
        .query(`
            Select
                r.id,
                r.uid,
                r.request_number,
                r.requester_id,
                u.[name] as requester_name,
                r.activity_type_id,
                at.[name] as activity_type_name,
                r.title,
                r.[description],
                r.[location],
                r.start_date,
                r.end_date,
                r.urgency,
                r.[status],
                r.created_at,
                r.updated_at
            from labor_requests as r
            Inner join users as u on u.id = r.requester_id
            Left join activity_types as at on at.id = r.activity_type_id
            Where r.id = @id
        `);

    return result.recordset[0];
}

export async function createLaborRequestAprovals(transaction, labor_request_id, departamentNumber) {
    const request = new sql.Request(transaction);
    const result = await request
        .input('labor_request_id', sql.Int, labor_request_id)
        .input('department', sql.Int, departamentNumber)
        .query('Insert Into labor_request_approvals (labor_request_id,department, created_at) Values (@labor_request_id, @department, GetDate())');

    return result.rowsAffected > 0;
}
