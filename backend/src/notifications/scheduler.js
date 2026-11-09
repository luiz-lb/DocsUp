/**
 * Agendador do notifier: a cada ciclo roda as rotinas que dependem de data / hora (prazos,
 * calendário dos mensais, resumo do RH). Cada rotina só GRAVA eventos na outbox, com uma
 * dedupe_key (o mesmo aviso nunca sai duas vezes); o envio segue o caminho normal (relay →
 * Kafka → consumidor).
 */

const jobs = [];

/** Registra uma rotina: { name, run: async (now) => número de eventos gravados }. */
export function registerJob(job) {
    jobs.push(job);
}

export function registeredJobs() {
    return [...jobs];
}

/** Roda todas as rotinas uma vez (também usado nos testes). */
export async function runJobsOnce(now = new Date(), log = console.log) {
    const results = {};
    for (const job of jobs) {
        try {
            results[job.name] = await job.run(now);
            if (results[job.name] > 0) log(`[agendador] ${job.name}: ${results[job.name]} evento(s)`);
        } catch (error) {
            results[job.name] = `erro: ${error.message}`;
            log(`[agendador] ${job.name} falhou: ${error.message}`);
        }
    }
    return results;
}

export function startScheduler({ intervalMs = 60000, log = console.log } = {}) {
    let stopped = false;
    let timer = null;
    let running = null;

    function schedule(delay) {
        if (stopped) return;
        timer = setTimeout(async () => {
            running = runJobsOnce(new Date(), log);
            await running;
            running = null;
            schedule(intervalMs);
        }, delay);
    }
    schedule(Math.min(5000, intervalMs));

    return {
        async stop() {
            stopped = true;
            clearTimeout(timer);
            if (running) await running;
        },
    };
}
