// Colaborador (JWT_SECRET) e fornecedor (SUPPLIER_JWT_SECRET) assinam os tokens com
// segredos diferentes: um token de fornecedor nunca é aceito nas rotas internas.
export function getSupplierJwtSecret() {
    const secret = process.env.SUPPLIER_JWT_SECRET;
    if (!secret) {
        throw new Error('SUPPLIER_JWT_SECRET não definido no .env.');
    }
    return secret;
}
