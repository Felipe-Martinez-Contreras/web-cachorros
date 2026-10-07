// Conventional Commits en español: `feat(partidos): agrega tabla de posiciones manual`.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-case': [0],
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
}
