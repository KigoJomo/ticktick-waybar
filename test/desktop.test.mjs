import test from "node:test";
import assert from "node:assert/strict";
import { walkerExecutable } from "../src/desktop.mjs";

test("Walker uses its direct dmenu executable with an optional override", () => {
  const previous = process.env.TICKBAR_WALKER_BIN;
  try {
    delete process.env.TICKBAR_WALKER_BIN;
    assert.equal(walkerExecutable(), "walker");
    process.env.TICKBAR_WALKER_BIN = "/tmp/mock-walker";
    assert.equal(walkerExecutable(), "/tmp/mock-walker");
  } finally {
    if (previous === undefined) delete process.env.TICKBAR_WALKER_BIN;
    else process.env.TICKBAR_WALKER_BIN = previous;
  }
});
