import React, { useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import styles from './page.module.css';

export default function Home() {
    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <p className={styles.eyebrow}>DocsUp</p>
                    <h1>Solicitação de produto</h1>
                    <p>Preencha os dados abaixo para registrar a solicitação para a obra.</p>
                </div>

                <form className={styles.form}>
                    <div className={styles.grid}>
                        <label className={styles.field}>
                            <span>Obra</span>
                            <input type="text" placeholder="Nome da obra" />
                        </label>


                        <label className={styles.field}>
                            <span>Data prevista</span>
                            <input type="text" class="datepicker" tpplugin="datepicker"/>
                        </label>

                        <label className={styles.field}>
                            <span>Produto</span>
                            <input type="text" placeholder="Ex.: cimento, tubo, elétrica" />
                        </label>

                        <label className={styles.field}>
                            <span>Quantidade</span>
                            <input type="number" min="1" placeholder="0" />
                        </label>

                        <label className={styles.field}>
                            <span>Prioridade</span>
                            <select defaultValue="">
                                <option value="" disabled>Selecione</option>
                                <option value="baixa">Baixa</option>
                                <option value="media">Média</option>
                                <option value="alta">Alta</option>
                            </select>
                        </label>

                        <label className={styles.field}>
                            <span>Solicitante</span>
                            <input type="text" placeholder="Nome do responsável" />
                        </label>
                    </div>

                    <label className={styles.field}>
                        <span>Observações</span>
                        <textarea rows="4" placeholder="Descreva detalhes, necessidade de entrega ou informações extras..." />
                    </label>

                    <div className={styles.actions}>
                        <button type="button" className={styles.secondaryButton}>Cancelar</button>
                        <button type="submit" className={styles.primaryButton}>Enviar solicitação</button>
                    </div>
                </form>
            </div>
        </div>
    );
}