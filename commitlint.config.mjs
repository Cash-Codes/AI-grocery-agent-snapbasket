export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "subject-case": [0],
    "scope-enum": [
      2,
      "always",
      [
        "db",
        "domain",
        "providers",
        "parser",
        "policy",
        "trigger",
        "observability",
        "api",
        "ui",
        "ops",
        "tooling",
        "test",
        "ci",
        "docs",
        "scaffold",
        "config",
        "deps",
      ],
    ],
  },
};
