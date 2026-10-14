import { api } from '../../../../utils/api';
import { toErrorResult } from '../../../../utils/apiError.js';

//End Point POST para logar na plataforma - User Everest
export async function loginApi(email, password) {
    try{
        const result = await api.post('/auth/login', { email, password });

        return result.data;
    } catch (erro) {
        // Propaga a mensagem específica do backend (ex.: "Senha incorreta.")
        if (erro.response?.data) {
            return erro.response.data;
        }
        return toErrorResult(erro, 'Erro interno ao tentar conectar com o servidor.');
    }
}

//End point GET para verificar com o cookie se o usuário está logado ainda ou não e se ainda é valido
export async function me(){
    try{
        const result = await api.get('/auth/me');

        return result.data;
    } catch (erro) {
        if (erro.response?.data) {
            return erro.response.data;
        }
        return toErrorResult(erro, 'Erro interno ao tentar conectar com o servidor.');
    }
}
