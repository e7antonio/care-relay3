export default class CircularBuffer<T> {
    private buffer: (T | undefined)[];
    private index: number;
    private filled: boolean;

    constructor(private size: number) {
        this.buffer = new Array<T | undefined>(size);
        this.index = 0;
        this.filled = false;
    }

    push(item: T): void {
        this.buffer[this.index] = item;
        this.index = (this.index + 1) % this.size;
        if (this.index === 0) this.filled = true;
    }

    getAll(): T[] {
        if (!this.filled) return this.buffer.slice(0, this.index) as T[];
        return this.buffer.slice(this.index).concat(this.buffer.slice(0, this.index)) as T[];
    }
}
