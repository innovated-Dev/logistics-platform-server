{
  "watch": ["src", "server.js"],
  "ext": "js,json",
  "ignore": ["node_modules", "tests", "*.test.js"],
  "exec": "node --experimental-specifier-resolution=node server.js",
  "env": { "NODE_ENV": "development" }
}