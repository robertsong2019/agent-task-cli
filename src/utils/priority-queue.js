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

  /**
   * Check if the queue is empty.
   * @returns {boolean}
   */
  isEmpty() {
    return this._items.length === 0;
  }

  /**
   * Remove and return the first item matching the comparator. Returns the removed item or undefined.
   * @param {*} item - Item to remove (matched by reference or comparator)
   * @param {Function} [cmp] - Optional comparator(item) => boolean
   * @returns {*} The removed item or undefined
   */
  remove(item, cmp) {
    const match = cmp || ((x) => x === item);
    const idx = this._items.findIndex(e => match(e.item));
    if (idx === -1) return undefined;
    const removed = this._items.splice(idx, 1)[0];
    return removed.item;
  }

  clear() {
    this._items = [];
  }

  toArray() {
    return this._items.map(e => e.item);
  }
}

module.exports = { PriorityQueue };
