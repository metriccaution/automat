import { config } from "./config";

test("Default config is valid", () => {
  expect(() => config.validate()).not.toThrow();
});
