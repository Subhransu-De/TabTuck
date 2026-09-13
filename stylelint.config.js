export default {
  extends: ["stylelint-config-recommended"],
  ignoreFiles: ["manage.css", "dist/**", "node_modules/**"],
  rules: {
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
