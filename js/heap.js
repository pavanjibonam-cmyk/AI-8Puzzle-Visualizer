(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MinHeap = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  class MinHeap {
    constructor(compare) {
      this.items = [];
      this.compare = compare;
    }

    get size() {
      return this.items.length;
    }

    push(item) {
      const a = this.items;
      a.push(item);
      let i = a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (this.compare(a[i], a[p]) >= 0) break;
        const t = a[i];
        a[i] = a[p];
        a[p] = t;
        i = p;
      }
    }

    pop() {
      const a = this.items;
      if (a.length === 0) return undefined;
      const top = a[0];
      const last = a.pop();
      if (a.length > 0) {
        a[0] = last;
        let i = 0;
        const n = a.length;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < n && this.compare(a[l], a[m]) < 0) m = l;
          if (r < n && this.compare(a[r], a[m]) < 0) m = r;
          if (m === i) break;
          const t = a[i];
          a[i] = a[m];
          a[m] = t;
          i = m;
        }
      }
      return top;
    }

    peek() {
      return this.items[0];
    }

    smallest(k, isLive, maxScan) {
      const a = this.items;
      const out = [];
      if (!a.length || k <= 0) return out;
      const aux = new MinHeap((x, y) => this.compare(a[x], a[y]));
      aux.push(0);
      let scanned = 0;
      const limit = maxScan || Infinity;
      while (aux.size && out.length < k && scanned < limit) {
        scanned++;
        const i = aux.pop();
        if (!isLive || isLive(a[i])) out.push(a[i]);
        const l = 2 * i + 1;
        if (l < a.length) aux.push(l);
        if (l + 1 < a.length) aux.push(l + 1);
      }
      return out;
    }
  }

  return MinHeap;
});
