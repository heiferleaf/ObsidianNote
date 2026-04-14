---
title: Harmony 应用开发目录结构
created: 2025-09-29 11:24
tags: [课程, 课程学习, 移动开发]
subject: 移动开发
modified: 2025-12-28 12:47
---
# 鸿蒙应用开发基础与目录结构查阅笔记

> 本笔记涵盖鸿蒙应用开发的打包结构、源码结构、Module分类、资源限定词与引用、主要配置文件及其标签，内容细致，便于快速查阅和理解。

---

## 一、核心概念结构

### 1. APP PACK 与 HAP

- **APP PACK**（分发包）：  
  应用最终安装包，包含一个或多个 HAP（HarmonyOS Ability Package）和 pack.info。
  ```
  APP_PACK/
  ├── entry.hap          # 主入口
  ├── feature1.hap       # 业务特性模块
  ├── feature2.hap
  ├── pack.info          # 分发包整体信息
  └── sharedLib.hsp      # 可选，共享库包
  ```

- **HAP**：  
  功能模块包，对应每个 Ability Module。每个 HAP 内部结构类似如下：
  ```
  entry.hap/
  ├── resources/
  ├── ets/
  ├── libs/
  ├── config.json
  └── xxx.abc
  ```

---

### 2. 开发态（源码结构）

- 一个应用由多个 Module 组成（Ability/Library Module）。
- 典型结构如下：
  ```
  MyHarmonyApp/
  ├── entry/                         # Ability Module（主入口）
  │   └── src/main/...
  ├── feature1/                      # Ability Module
  │   └── src/main/...
  ├── myLib/                         # Library Module（生成 HAR）
  │   └── src/main/...
  ├── sharedLib/                     # Library Module（生成 HSP，共享库）
  │   └── src/main/...
  ├── package.json                   # 项目依赖
  ├── build-profile.json             # 构建配置
  └── ...
  ```

---

### 3. Module 分类与产物

| 类型           | 产物   | 作用/说明                 |
|----------------|--------|---------------------------|
| Ability Module | HAP    | 页面/业务能力模块         |
| Library Module | HAR/HSP| HAR:本地开发依赖/HSP:共享 |

- **HAR**：开发时依赖，用于代码复用，不单独分发。
- **HSP**：运行时共享库，可被多个 HAP 共享。

---

## 二、resources 资源目录结构

### 1. 标准结构

```
resources/
├── base/
│   ├── element/       # 字符串、颜色等
│   ├── media/         # 图片、音频等
│   ├── profile/       # 配置文件
│   └── ...
├── zh_CN/             # 简体中文资源
│   ├── element/
│   ├── media/
│   ├── profile/
├── en_US/             # 英文资源
│   ├── element/
│   ├── media/
│   ├── profile/
├── <限定词组合>/       # 如 en_GB-vertical-car-mdpi，开发者自定义
│   ├── element/
│   ├── media/
│   ├── profile/
├── rawfile/           # 原始文件（如PDF、txt等）
```

### 2. 资源限定词命名规则

- 格式：`<language>_<country>-<device>-<orientation>-<density>/`
- 示例：`en_US-phone-vertical-mdpi/`
- 常用限定词：
  - 语言：en, zh
  - 地区：US, CN
  - 设备类型：phone, tablet, car, tv
  - 屏幕方向：vertical, horizontal
  - 分辨率：ldpi, mdpi, hdpi, xhdpi

---

## 三、资源引用方式

- **字符串资源**：`$localize('string_key')`  
  自动匹配当前语言环境的字符串
- **图片资源**：`Image({ src: $r('app.media.icon') })`  
  自动匹配限定词目录下图片
- **配置文件资源**：`let data = $r('app.profile.test_profile')`
- **原始文件资源**：`let rawPath = $r('app.rawfile.intro')`
- **系统查找优先级**：完全限定词 > 部分限定词 > base 目录

---

## 四、主要配置文件及结构

### 1. 开发态配置文件

| 文件名               | 位置/范围           | 作用                         |
|----------------------|---------------------|------------------------------|
| package.json         | 项目根目录          | 项目依赖、脚本配置           |
| build-profile.json   | 项目根目录          | 构建和打包参数配置           |
| app.json             | 根目录或src/main    | 应用全局配置                 |
| config.json          | 每个Module/src/main | Ability、权限、入口声明      |
| profile/*.json       | resources/profile/  | 资源/自定义配置              |
| element/string.json  | resources/element/  | 字符串资源，本地化/国际化    |

### 2. APP PACK配置文件

| 文件名       | 位置           | 说明              |
|--------------|----------------|-------------------|
| pack.info    | APP PACK根目录 | 分发包整体信息    |
| config.json  | 每个HAP内      | 模块能力声明      |

---

## 五、module.json标签形象讲解

| 名称                 | 形象比喻/解释                                           |
|----------------------|--------------------------------------------------------|
| **pages**            | 像书的目录，列出所有页面                                 |
| **metadata**         | 像书的扉页标签，自定义元数据                            |
| **abilities**        | 像图书馆分区说明，列出UIAbility能力入口                 |
| **extensionAbilities** | 像附加二维码/音频内容，列出后台/扩展能力              |
| **requestPermissions** | 像借阅/复印申请表，声明应用需要的系统权限             |

### module.json结构示例

```json
{
  "pages": [
    "pages/Home",
    "pages/About"
  ],
  "abilities": {
    "HomeAbility": { "type": "page", "src": "pages/Home" }
  },
  "extensionAbilities": {
    "DataSyncAbility": { "type": "service", "src": "services/DataSync" }
  },
  "requestPermissions": {
    "permissions": ["CAMERA", "INTERNET", "LOCATION"]
  },
  "metadata": [
    { "key": "author", "value": "张三" }
  ]
}
```

---

## 六、快速查阅结构图

```
MyHarmonyApp/                 # 开发态
├── entry/                    # Ability Module -> entry.hap
├── feature1/                 # Ability Module -> feature1.hap
├── myLib/                    # Library Module -> myLib.har
├── sharedLib/                # Library Module -> sharedLib.hsp
├── package.json
├── build-profile.json
└── ...

MyHarmonyApp_APP_PACK/        # 发布态
├── entry.hap
├── feature1.hap
├── pack.info
└── sharedLib.hsp

resources/                    # 资源目录（所有模块下都有）
├── base/
├── zh_CN/
├── en_US/
├── <限定词组合>/
├── rawfile/
```

---

## 七、文档参考

- [鸿蒙官方资源限定词说明](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V3/resource-directory-0000001153685918)
- [HarmonyOS配置文件说明](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V3/application-configurations-0000001053824335)

---

# 结语

本笔记涵盖了鸿蒙应用开发的模块划分、目录结构、资源限定词与引用方式、配置文件及其标签解释，适合快速查阅与理解开发流程及规范。  
如需补充具体配置文件内容或更多场景案例，可随时补充！
