import { Task } from "./Task";

export class TaskQueuer {
    private queue: Array<Task>;
    private isRunningTask: boolean;
    
    constructor() {
        this.queue = [];
        this.isRunningTask = false;
    }

    add(...tasks: Task[]): void {
        this.queue.push(...tasks);

        if (!this.isRunningTask) {
            (async () => {
                await this.runAllTasks();
            })();
        }
    }

    private async runAllTasks(): Promise<void> {
        if (this.queue.length === 0) {
            return;
        }

        this.isRunningTask = true;

        const nextTask = this.queue.shift();
        await nextTask!();

        await this.runAllTasks();

        this.isRunningTask = false;
    }
}