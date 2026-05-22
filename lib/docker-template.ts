export function generateDockerfileTemplate(repository: string, tag: string): string {
  return `FROM ${repository}:${tag}

# 在此添加自定义配置
# 示例：
# RUN apk add --no-cache vim curl
# ENV MY_VAR=value
# COPY custom-config.yaml /app/config/
`
}