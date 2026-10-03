export default {
  extends: ["stylelint-config-recommended"],
  ignoreFiles: ["dist/**", "node_modules/**"],
  rules: {
    // The manager styles many independent components. Source order between
    // unrelated selectors such as ".keys button" and ".acts button" is not a
    // cascade dependency, so this rule only reports false positives there.
    "no-descending-specificity": null,
    "at-rule-no-unknown": [
      true,
      { ignoreAtRules: ["apply", "source", "theme"] },
    ],
    "at-rule-prelude-no-invalid": [
      true,
      { ignoreAtRules: ["apply", "source", "theme"] },
    ],
  },
};
