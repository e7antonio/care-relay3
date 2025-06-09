class CircularBuffer {
    constructor(size) {
        this.size = size;
        this.buffer = new Array(size);
        this.index = 0;
        this.filled = false;
    }

    push(item) {
        this.buffer[this.index] = item;
        this.index = (this.index + 1) % this.size;
        if (this.index === 0) this.filled = true;
    }

    getAll() {
        if (!this.filled) return this.buffer.slice(0, this.index);
        return this.buffer.slice(this.index).concat(this.buffer.slice(0, this.index));
    }
}

module.exports = CircularBuffer;
