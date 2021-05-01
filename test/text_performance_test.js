/* eslint-disable no-console */
const {
  performance,
  PerformanceObserver,
} = require("perf_hooks")
const Automerge = require("../src/automerge")

// Automerge.setDefaultBackend(require("../automerge-rs/automerge-backend-wasm/build/cjs"))

describe("Rehydrating a document with a lot of text changes", () => {
  let perfObserver
  let performanceEntries = []

  before(() => {
    perfObserver = new PerformanceObserver(items => performanceEntries.push(...items.getEntries()))

    perfObserver.observe({
      entryTypes: ["measure"],
      buffered: true
    })
  })

  after(() => {
    console.log("Performance Entries")
    console.log("change count".padEnd(15), "type".padEnd(15), "duration (ms)")

    performanceEntries.forEach((entry) => {
      console.log(
        entry.detail.count.toString().padEnd(15),
        entry.detail.type.toString().padEnd(15),
        Math.round(entry.duration)
      )
    })

    perfObserver.disconnect()
  })

  ;[500, 1000, 2000].forEach((textChanges) => {
    // TOOD: 50ms is arbitrary. The event loop must not be blocked for very long though
    // NOTE: since both applyChanges and snapshot are sync functions, there is no need to measure event loop utilization
    const maxBlockingTimeMs = 50

    context(`applyChanges for ${textChanges} changes`, function () {
      this.timeout(maxBlockingTimeMs)

      it(`should not block the event loop for more than ${maxBlockingTimeMs}ms`, () => {
        applyChanges(textChanges)
      })
    })

    context(`snapshot of ${textChanges} changes`, function () {
      this.timeout(maxBlockingTimeMs)

      it(`should not block the event loop for more than ${maxBlockingTimeMs}ms`, () => {
        snapshot(textChanges)
      })
    })
  })
})

function applyChanges(textChanges) {
  let n1 = simulateInputOverTime(textChanges)

  measureAround(() => Automerge.applyChanges(Automerge.init(), Automerge.getAllChanges(n1)), {
    count: textChanges,
    type: "applyChanges"
  })
}

function snapshot(textChanges) {
  let snapshot = Automerge.save(simulateInputOverTime(textChanges))

  measureAround(() => Automerge.load(snapshot), {
    count: textChanges,
    type: "load"
  })
}

function simulateInputOverTime(textChanges) {
  let doc = Automerge.init()

  doc = Automerge.change(doc, { time: 0 }, (doc) => (doc.n = new Automerge.Frontend.Text()))
  for (let i = 0; i < textChanges; i++) {
    doc = Automerge.change(doc, { time: 0 }, (doc) => doc.n.insertAt(0, "a"))
  }

  return doc
}

function measureAround(action, detail) {
  const START_MARKER = `start`

  performance.mark(START_MARKER)

  action()

  performance.measure(`sync`, {
    detail,
    start: START_MARKER,
  })
}
