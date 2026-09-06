// @vitest-environment happy-dom

import { expect, it } from "vitest";
import { highlightSource } from "./codeView.ts";

it("preserves copyable source text and renders embedded HTML as code", () => {
  const source = `<!-- note -->\n<script>alert("<unsafe>&")</script>\nconst value = 'hello';\n// comment\n`;
  const node = document.createElement("code");
  node.innerHTML = highlightSource(source);
  expect(node.textContent).toBe(source);
  expect(node.querySelector("script")).toBeNull();
  expect(node.querySelector(".syntax-comment")).not.toBeNull();
  expect(node.querySelector(".syntax-keyword")).not.toBeNull();
});
