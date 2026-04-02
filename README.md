# 3D地球数据可视化

一个使用Three.js创建的3D地球可视化页面，展示全球城市分布和用户数据。

## 功能特性

- 3D可旋转地球
- 城市灯光效果（呼吸灯模式）
- 点击城市显示用户数据
- 随机品牌展示
- 人气榜排名
- 响应式设计

## 技术栈

- HTML5
- CSS3
- JavaScript
- Three.js

## 部署到Netlify

### 步骤1：创建GitHub仓库
1. 在GitHub上创建一个新的仓库
2. 将以下文件上传到仓库：
   - `index.html`
   - `README.md`

### 步骤2：部署到Netlify
1. 访问 [Netlify](https://vercel.com)
2. 点击 "New Project"
3. 选择 "Import an existing project"
4. 连接您的GitHub账号
5. 选择刚刚创建的仓库
6. 点击 "Deploy"
7. 等待部署完成

### 步骤3：访问网站
Netlify会为您生成一个HTTPS链接，您可以使用该链接访问您的3D地球页面。

## 墨刀嵌入

部署完成后，您可以在墨刀的"网页嵌入"组件中使用以下代码：

```html
<iframe src="https://your-netlify-site.netlify.app" width="100%" height="600px" frameborder="0" allowfullscreen></iframe>
```

将 `https://your-netlify-site.netlify.app` 替换为您的Netlify网站链接。

## 注意事项

- 确保网络连接稳定，以便加载Three.js库和地球纹理
- 页面可能需要几秒钟时间加载3D地球
- 在移动设备上可能会有性能限制

## 效果预览

![3D地球预览](https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=3D%20earth%20with%20city%20lights%20at%20night%2C%20interactive%20globe%20visualization%2C%20luxury%20design%20style&image_size=landscape_16_9)
