import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

@Injectable()
export class SchedulerService {

    constructor(
        private schedulerRegistry: SchedulerRegistry,
        private logger: Logger
    ) { }

    addCronJob(name: string, cronTime: string, callback: () => void) {
        const job = new CronJob(cronTime, callback);
        this.schedulerRegistry.addCronJob(name, job);
        job.start();
        this.logger.log(`Job ${name} added!`);
    }

    getCronJobWithName(name: string) {
        const job = this.schedulerRegistry.getCronJob(name);

        if (!job) {
            return { error: `No cron job found with name: ${name}` };
        }

        const nextDates = job.nextDates(5);
        return {
            name,
            timeZone: job.cronTime || 'system default',
            running: job.isCallbackRunning ,
            lastExecution: job.lastExecution ? job.lastExecution.toISOString() : null,
            nextRuns: Array.isArray(nextDates)
                ? nextDates.map(d => d.toJSDate())
                : [nextDates],
        };
    }


    startCronJob(name: string) {
        const job = this.schedulerRegistry.getCronJob(name);
        job.start();
        this.logger.log(`Job ${name} started!`);
    }

    stopCronJob(name: string) {
        const job = this.schedulerRegistry.getCronJob(name);
        job.stop();
        this.logger.log(`Job ${name} stopped!`);
    }

    removeCronJob(name: string) {
        this.schedulerRegistry.deleteCronJob(name);
        this.logger.log(`Job ${name} removed!`);
    }

    listJobs() {
        const jobs = this.schedulerRegistry.getCronJobs();
        const jobList: any[] = [];

        jobs.forEach((value, key) => {
            const nextDates = value.nextDates(5); 
            jobList.push({
                name: key,
                running: !value.isCallbackRunning,
                nextRuns: Array.isArray(nextDates)
                    ? nextDates.map(d => d.toJSDate())
                    : [nextDates],
            });
        });

        return jobList;
    }

}
