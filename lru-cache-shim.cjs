class LRUCache {
  constructor(options = {}) {
    this.max = options.max || 1024
    this.map = new Map()
  }

  get(key) {
    if (!this.map.has(key)) return undefined
    const value = this.map.get(key)
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  set(key, value) {
    if (this.map.has(key)) {
      this.map.delete(key)
    }
    this.map.set(key, value)
    if (this.map.size > this.max) {
      const oldestKey = this.map.keys().next().value
      this.map.delete(oldestKey)
    }
  }

  has(key) {
    return this.map.has(key)
  }

  delete(key) {
    return this.map.delete(key)
  }

  clear() {
    this.map.clear()
  }
}

module.exports = { LRUCache }
