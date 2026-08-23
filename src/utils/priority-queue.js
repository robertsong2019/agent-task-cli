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

  /** F138: peekAt(n) — peek at the Nth item (0-indexed) without dequeuing. Returns undefined if out of bounds. */
  peekAt(n) {
    if (typeof n !== 'number' || n < 0 || !Number.isInteger(n)) {
      throw new RangeError('peekAt: n must be a non-negative integer');
    }
    const entry = this._items[n];
    return entry ? entry.item : undefined;
  }

  clear() {
    this._items = [];
  }

  toArray() {
    return this._items.map(e => e.item);
  }

  /**
   * F160: drain() — dequeue all items in priority order, leaving the queue empty.
   * Returns array of items (empty if queue was already empty).
   */
  drain() {
    const items = this._items.map(e => e.item);
    this._items = [];
    return items;
  }

  /**
   * F172: toSortedArray() — return all items in priority order without modifying the queue.
   * Non-destructive peek at the full sorted contents.
   * @returns {Array} items in priority order
   */
  toSortedArray() {
    return this._items.map(e => e.item);
  }

  /**
   * F189: contains(item, cmp?) — check if an item exists in the queue.
   * @param {*} item - Item to search for
   * @param {Function} [cmp] - Optional comparator(item) => boolean
   * @returns {boolean} true if item is in the queue
   */
  contains(item, cmp) {
    const match = cmp || ((x) => x === item);
    return this._items.some(e => match(e.item));
  }

  /**
   * F190: updatePriority(item, newPriority, cmp?) — update the priority of an existing item.
   * Re-sorts the queue after update. Returns true if found and updated, false if not found.
   * @param {*} item - Item to find
   * @param {number} newPriority - New priority value
   * @param {Function} [cmp] - Optional comparator(item) => boolean
   * @returns {boolean} true if updated
   */
  updatePriority(item, newPriority, cmp) {
    if (typeof newPriority !== 'number') {
      throw new TypeError('updatePriority: newPriority must be a number');
    }
    const match = cmp || ((x) => x === item);
    const idx = this._items.findIndex(e => match(e.item));
    if (idx === -1) return false;
    this._items[idx].priority = newPriority;
    this._items.sort((a, b) => a.priority - b.priority || a.seq - b.seq);
    return true;
  }

  /**
   * F192: removeAt(index) — remove and return the item at the specified index.
   * @param {number} index - 0-based index into priority-sorted queue
   * @returns {*} The removed item, or undefined if index is out of bounds
   */
  removeAt(index) {
    if (typeof index !== 'number' || index < 0 || !Number.isInteger(index)) {
      throw new RangeError('removeAt: index must be a non-negative integer');
    }
    if (index >= this._items.length) return undefined;
    const removed = this._items.splice(index, 1)[0];
    return removed.item;
  }

  /**
   * F171: drainUntil(predicate) — dequeue items while predicate holds.
   * Predicate receives (item, priority) and should return boolean.
   * Stops at first item where predicate is false, that item remains in queue.
   * Returns array of drained items (empty if queue was empty or predicate always false).
   */
  drainUntil(predicate) {
    if (typeof predicate !== 'function') {
      throw new TypeError('drainUntil: predicate must be a function');
    }
    
    const drained = [];
    const remaining = [];
    
    for (const entry of this._items) {
      const shouldKeep = predicate(entry.item, entry.priority);
      if (shouldKeep) {
        drained.push(entry);
      } else {
        remaining.push(entry);
      }
    }
    
    this._items = remaining;
    return drained;
  }

  /**
   * Returns the priority of the item at the front of the queue.
   * Returns undefined for empty queue.
   * @returns {number|undefined}
   */
  frontPriority() {
    if (this._items.length === 0) return undefined;
    return this._items[0].priority;
  }

  /**
   * Returns a shallow copy of all items sorted by priority.
   * Does not modify the queue.
   * @returns {Array}
   */
  toSortedArray() {
    return this._items.map(e => e.item);
  }

  /**
   * Returns all items with a specific priority value.
   * @param {number} priority
   * @returns {Array}
   */
  getByPriority(priority) {
    return this._items
      .filter(e => e.priority === priority)
      .map(e => e.item);
  }

  /**
   * F227: merge(otherQueue) — merge another PriorityQueue into this one.
   * All items from otherQueue are added to this queue, then re-sorted.
   * The other queue is emptied.
   * @param {PriorityQueue} otherQueue — queue to merge from
   * @returns {number} count of items merged
   */
  merge(otherQueue) {
    if (!otherQueue || !Array.isArray(otherQueue._items)) {
      throw new TypeError('merge: argument must be a PriorityQueue');
    }
    const count = otherQueue._items.length;
    for (const entry of otherQueue._items) {
      this._items.push({ item: entry.item, priority: entry.priority, seq: this._seq++ });
    }
    this._items.sort((a, b) => a.priority - b.priority || a.seq - b.seq);
    otherQueue._items = [];
    return count;
  }

  /**
   * F236: getValues() — return raw items in priority order without priority wrapper.
   * Unlike toSortedArray() which returns {item, priority} objects, this returns
   * just the item values, useful when callers don't need priority metadata.
   * @returns {Array} items in priority order
   */
  getValues() {
    return this._items
      .slice()
      .sort((a, b) => a.priority - b.priority || a.seq - b.seq)
      .map(e => e.item);
  }

  /**
   * F242: priorities() — distinct priority levels currently in the queue, sorted ascending.
   * Returns []. Introspection helper (e.g. "which urgency bands are pending?").
   * @returns {number[]} sorted unique priorities
   */
  priorities() {
    return [...new Set(this._items.map(e => e.priority))].sort((a, b) => a - b);
  }

  /**
   * F243: enqueueAll(items, priority) — bulk enqueue (inverse of batch()).
   * Returns new queue size. Empty array is a no-op.
   * @param {Array} items — items to enqueue
   * @param {number} priority — priority for all items (default 5)
   * @returns {number} queue size after enqueue
   */
  enqueueAll(items, priority = 5) {
    if (!Array.isArray(items)) throw new TypeError('enqueueAll: items must be an array');
    for (const item of items) this.enqueue(item, priority);
    return this._items.length;
  }

  /**
   * F240: batch(n) — dequeue up to n items in priority order.
   * Returns fewer items if the queue has less than n. Always returns an array.
   * @param {number} n — max number of items to dequeue (0 returns [])
   * @returns {Array} dequeued items in priority order
   */
  batch(n) {
    if (!Number.isInteger(n) || n < 0) {
      throw new TypeError('batch: n must be a non-negative integer');
    }
    const out = [];
    while (out.length < n && this._items.length > 0) {
      out.push(this._items.shift().item);
    }
    return out;
  }
}

module.exports = { PriorityQueue };
