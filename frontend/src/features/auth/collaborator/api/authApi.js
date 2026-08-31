import { api } from '../../../../utils/api';

//End Point POST para logar na plataforma - User Everest
export async function loginApi(email, password) {
    try{
        const result = await api.post('/auth/login', { email, password });

        return result.data;
    } catch (erro) {
        if (erro.response && erro.response.status === 401) {
            return erro.response.data
        } else {
            return { success: false, body: { message: "Erro interno ao tentar conectar com o servidor." } }
        }
    }
}

//End point GET para verificar com o cookie se o usuário está logado ainda ou não e se ainda é valido
export async function me(){
    try{
        const result = await api.get('/auth/me');

        return result.data;
    } catch (erro) {
        if (erro.response && erro.response.status === 401) {
            return erro.response.data
        } else {
            return { success: false, body: { message: "Erro interno ao tentar conectar com o servidor." } }
        }
    }
}