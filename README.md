# 命运织途 · 转职路线模拟器

纯前端静态网页，使用项目内的 `角色数据.txt` 与 `职业成长率.txt` JSON 数据制作。职业选择与路线由用户操作决定；转职等级为初级 Lv.10、中级 Lv.20、上级 Lv.35、最上级 Lv.45；神将职业不参与模拟。

## 启动

在项目目录启动本地服务器，然后访问 `http://127.0.0.1:8000`：

```bash
node server.js
```

由于浏览器安全限制，请通过网页服务器访问，不要直接双击 `index.html`。

## 文件

- `index.html`、`styles.css`、`app.js`：网页界面与交互
- `data/characters.json`、`data/classes.json`：网页读取的角色与职业数据副本
