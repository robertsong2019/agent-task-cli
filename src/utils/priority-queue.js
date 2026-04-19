class PriorityQueue {
  constructor() {
    this._items = [];
    this._seq = 0;
  }

  get size() {
    return this._items.length;
  }

  enqueue(item, priority = 5) {
    this._items.push({ item, priority, seq: this._seq++ });
    this._items.sort((a, b) => a.priority - b.priority || a.seq - b.seq);
    return this;
  }

  dequeue() {
    const entry = this._items.shift();
    return entry ? entry.item : undefined;
  }

  peek() {
    return this._items.length ? this._items[0].item : undefined;
  }

  clear() {
    this._items = [];
  }

  toArray() {
    return this._items.map(e => e.item);
  }
}

module.exports = { PriorityQueue };
