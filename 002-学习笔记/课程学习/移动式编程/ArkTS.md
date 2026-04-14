---
title: ArkTS
created: 2025-10-04 11:42
tags: [课程, 课程学习, 移动开发]
subject: 移动开发
modified: 2025-12-28 12:47
---
感谢你的反馈！下面我将针对你上面提供的大量ArkUI/ArkTS组件开发内容，进行更具体、分条、深入的知识点梳理，包括场景、代码细节、注意事项与最佳实践，力求做到详尽易查。

---

# ArkUI（ArkTS）组件开发全知识点详解

---

## 一、装饰器（Decorator）

### 1.1 @Entry
- 用途：标记入口组件（页面的唯一根组件），一个页面只能有一个@Entry。
- 用法：只能用于struct声明的组件上。
- 选项：可接受LocalStorage参数以支持页面持久化。

### 1.2 @Component
- 用途：声明自定义组件。
- 用法：必须装饰struct，且一个struct只能有一个@Component。

### 1.3 @State
- 用途：定义组件内的响应式状态变量。
- 特性：变量变化时自动触发build()重渲染，驱动UI刷新。
- 注意：@State变量仅在当前组件内生效，不支持跨组件同步。

### 1.4 @Builder 和 @BuilderParam
- @Builder：修饰自定义构建函数（UI片段），支持更细粒度的复用。
- @BuilderParam：修饰传递给@Builder方法的参数，允许父组件动态赋值，定制化子组件行为（如事件、渲染等）。
- 只能在自定义构建函数的参数上使用。

### 1.5 @Styles
- 用途：将一组样式封装成方法，实现样式复用。
- 支持全局（function）和组件内定义，组件内优先生效。
- 不支持带参数。

### 1.6 @Extend
- 用于扩展系统组件（如Text、Button等）的样式和属性。
- 只能全局定义，支持带参数。

---

## 二、组件体系

### 2.1 系统组件
- 内置基础、布局组件，如Column、Row、Stack、Grid、Text、Image、Button、Divider、List等。
- 容器组件（Column、Row等）支持子组件嵌套，实现复杂布局。

### 2.2 自定义组件
- 必须以`struct`声明，并用@Component装饰。
- 必须实现build()方法，描述UI结构。
- 支持成员变量（私有），可用@State/@Prop/@Link修饰。
- 支持成员方法（私有），不支持静态方法和变量。

#### 2.2.1 数据驱动
- @State/@Link/@StorageLink修饰变量可驱动UI变化。
- @Prop用于父传子只读属性，@Link用于父子双向绑定。

#### 2.2.2 组合与复用
- 自定义组件可嵌套、组合系统或其他自定义组件。
- 支持多实例化，提升复用性。

#### 2.2.3 参数传递
- 通过构造参数（对象方式）或@BuilderParam实现灵活传参。
- 支持按值、按引用传递（推荐用@Link实现响应式引用）。

---

## 三、UI描述与属性、事件配置

### 3.1 build()函数
- 组件声明式UI描述唯一入口。
- 根节点唯一且必要，@Entry组件必须以容器组件为根。
- 不支持声明本地变量、不支持switch语法。

### 3.2 属性方法
- 用于配置组件的样式和属性，链式调用（如.fontSize(20)）。
- 支持传递枚举类型参数（如Color.Red、FontWeight.Bold）。
- 每个属性方法建议单独一行书写。

### 3.3 事件方法
- 用于配置事件响应（如.onClick()）。
- 支持lambda、匿名函数（匿名函数建议bind(this)确保上下文）。
- 事件方法链式调用，建议单独一行。

#### 3.3.1 Lambda与匿名函数示例
```typescript
Button('Click Me')
  .onClick(() => { this.myText = 'ArkUI'; })

Button('Add')
  .onClick(function() { this.counter += 1; }.bind(this))
```

---

## 四、子组件嵌套与参数用法

### 4.1 子组件配置
- 容器组件通过尾随闭包{}描述子组件UI。
- 支持嵌套多级子组件。

### 4.2 参数传递
- 构造参数形式：`Text('test')`，`Image(url)`，`Child({ message: 'Hello!' })`
- 支持资源文件引用`Text($r('app.string.title_value'))`（多语言适用）。

---

## 五、状态管理与响应式

### 5.1 @State
- 仅在当前组件内生效。
- 状态变化自动驱动build()重渲染。

### 5.2 @Prop
- 父组件传递只读参数给子组件。
- 子组件不能修改@Prop变量。

### 5.3 @Link
- 父子组件间双向同步。
- 子组件可直接修改@Link变量，父组件也会同步更新。

### 5.4 @StorageLink
- 用于持久化同步存储的状态变量（如LocalStorage）。

---

## 六、生命周期

### 6.1 页面生命周期（@Entry组件）
- `onPageShow()`：页面每次显示时触发。
- `onPageHide()`：页面每次隐藏时触发。
- `onBackPress()`：用户点击返回按钮时触发。

### 6.2 组件生命周期（@Component组件）
- `aboutToAppear()`：组件即将出现（build前）。
- `aboutToDisappear()`：组件即将销毁。
- 可用于资源申请、销毁、数据初始化等场景。

### 6.3 生命周期流转顺序
```
aboutToAppear() → build() → onPageShow()（页面可见）→ onPageHide()/onBackPress() → aboutToDisappear()
```

---

## 七、样式复用与扩展

### 7.1 @Styles（样式复用）
- 支持全局和组件内定义。
- 组件内可访问状态变量，全局不行。
- 用法如：`.fancy()`，`.globalFancy()`。

### 7.2 @Extend（样式扩展）
- 只能全局定义，支持参数。
- 用于扩展系统组件的属性或事件。
- 用法如：`.fancy(16)`，`.superFancyText(24)`。

#### 示例
```typescript
@Extend(Text) function fancy(fontSize: number) {
  .fontColor(Color.Red)
  .fontSize(fontSize)
}
Text('Fancy').fancy(16)
```

### 7.3 stateStyles（状态样式）
- 类似CSS伪类，根据组件内部状态自动切换样式。
- 支持状态：focused、normal、pressed、disabled、selected。
- 用法如：
```typescript
Button('Button1')
  .stateStyles({
    focused: { .backgroundColor('#ffffeef0') },
    pressed: { .backgroundColor('#ff707070') },
    normal: { .backgroundColor('#ff2787d9') }
  })
```

---

## 八、@Builder/@BuilderParam自定义构建函数

### 8.1 @Builder
- 封装可复用UI片段。
- 支持组件内和全局定义（全局无this/bind）。
- 仅在所属组件的build和其他@Builder函数中调用。

### 8.2 @BuilderParam
- 用于为@Builder修饰的自定义构建函数传递参数，实现定制功能（如事件、渲染等）。
- 只能用在自定义构建函数的参数上。
- 父组件可动态传递不同构建函数，定制子组件行为。

#### 示例
```typescript
@Component
struct Child {
  @Builder customRender() { ... }
  @BuilderParam customRenderParam: () => void = this.customRender;
  build() {
    Column() { this.customRenderParam() }
  }
}
@Entry
@Component
struct Parent {
  @Builder parentRender() { Text('From Parent') }
  build() {
    Column() { Child({ customRenderParam: this.parentRender }) }
  }
}
```

---

## 九、组件的创建、渲染与销毁

### 9.1 创建流程
1. ArkUI框架在内存中创建自定义组件实例。
2. 成员变量初始化（默认值/传参）。
3. aboutToAppear()（如有）回调。
4. 首次渲染时执行build()，渲染系统和子组件。
5. 通过状态变量变化自动驱动UI刷新。

### 9.2 删除流程
- 组件被移除（如if/ForEach分支切换）时，aboutToDisappear()回调。
- 后端节点直接销毁，前端节点无引用时由JS虚拟机GC。

---

## 十、开发注意事项与最佳实践

1. **装饰器使用**：合理分配@Entry、@Component，避免重复或遗漏。
2. **成员变量与函数**：全部为私有，不支持静态。
3. **build()方法规范**：根节点唯一且必要，@Entry下必须为容器组件。
4. **业务逻辑与UI解耦**：UI与业务分离，提升维护性与复用性。
5. **事件方法this指向**：匿名函数需.bind(this)，防止上下文错误。
6. **样式复用优先级**：优先用@Styles，复杂扩展用@Extend。
7. **状态变量管理**：用@State/@Link/@StorageLink等修饰可响应变量。
8. **生命周期管理**：善用aboutToAppear/aboutToDisappear等钩子，合理初始化和释放资源。
9. **参数类型检查**：严格遵循类型要求，避免传递undefined/null。
10. **性能优化**：避免无谓的状态更新与深层嵌套，提升渲染效率。

---

## 十一、典型代码片段参考

### 11.1 自定义组件
```typescript
@Component
struct HelloComponent {
  @State message: string = 'Hello, World!';
  build() {
    Row() {
      Text(this.message)
        .onClick(() => { this.message = 'Hello, ArkUI!'; })
    }
  }
}
```

### 11.2 父组件调用子组件并传参
```typescript
@Entry
@Component
struct ParentComponent {
  build() {
    Column() {
      HelloComponent({ message: 'Hello, World!' })
      Divider()
      HelloComponent({ message: '你好!' })
    }
  }
}
```

### 11.3 自定义构建函数与@BuilderParam
```typescript
@Component
struct Child {
  @Builder customRender() { Text("Default") }
  @BuilderParam customRenderParam: () => void = this.customRender;
  build() {
    Column() { this.customRenderParam() }
  }
}
@Entry
@Component
struct Parent {
  @Builder parentRender() { Text('Parent Custom') }
  build() {
    Column() { Child({ customRenderParam: this.parentRender }) }
  }
}
```

---

好的，以下是对你提供的 ArkUI（ArkTS）状态管理、渲染控制、基础类库与并发等内容的详细、分条、深入整理，包含核心概念、用法、注意事项、典型代码和机制原理，结构清晰，便于查阅和理解。

---

# 一、状态管理

## 1.1 概述

- 动态交互UI的本质是“状态驱动UI”——UI是状态变量的投影，状态变化自动引发UI刷新。
- 组件变量只有被特定装饰器修饰后，才具备“响应式”，即其变化会触发UI渲染。
- ArkUI提供了多粒度（组件级/应用级）、多类型（单向/双向/跨层级）状态管理装饰器。

---

## 1.2 核心概念及机制

- **状态变量**：被状态装饰器（如@State/@Link/@Prop等）修饰的变量，变化引发UI刷新。
- **常规变量**：无装饰器，仅作临时计算，变化不会引发UI刷新。
- **数据源/同步源**：状态变量的原始来源（如父组件传值）。
- **命名参数机制**：通过对象方式传参，父组件赋值给子组件状态变量。
- **本地初始化**：变量声明时赋默认值，若有父组件传值则被覆盖。

---

## 1.3 组件级状态管理装饰器

### 1.3.1 @State
- **基础响应式变量**，私有，仅组件内可见。
- 变化自动刷新UI，可单向/双向同步给子组件的@Prop/@Link。
- 支持基础类型（string/number/boolean/enum）、对象、数组（必须显式指定类型）。
- 生命周期与组件一致，变量初始化必须赋值，不能为undefined/null/any/联合类型。

```typescript
@Component
struct Counter {
  @State value: number = 1;
  build() {
    Text(`Count: ${this.value}`)
    Button("Add").onClick(() => { this.value++ })
  }
}
```

### 1.3.2 @Prop
- 父子单向同步。父组件→子组件，子组件本地可变更但不会同步回父组件。
- 父组件更新会覆盖子组件本地变更。
- 支持基础类型、对象、数组，类型需一致。

```typescript
@Component
struct Child {
  @Prop title: string;
  build() { Text(this.title) }
}
@Entry
@Component
struct Parent {
  @State bookTitle: string = 'ArkUI';
  build() { Child({ title: this.bookTitle }) }
}
```

### 1.3.3 @Link
- 父子双向同步。父@State/@Link/@StorageLink <—> 子@Link。
- 类型必须一致，禁止本地初始化，必须从父组件传值。
- 适合组件间需要同步更新的场景（如表单双向绑定）。

```typescript
@Component
struct Child {
  @Link count: number;
  build() { Button("Add").onClick(() => { this.count++ }) }
}
@Entry
@Component
struct Parent {
  @State value: number = 1;
  build() { Child({ count: $value }) }
}
```

### 1.3.4 @Provide / @Consume
- 用于跨多层级（非直接父子）组件的数据同步，避免多层参数传递。
- 祖先组件@Provide声明变量，后代组件@Consume绑定同名或别名变量，实现双向同步。

```typescript
@Entry
@Component
struct Ancestor {
  @Provide shared: number = 100;
  build() { Descendant() }
}
@Component
struct Descendant {
  @Consume shared: number;
  build() { Text(`共享值：${this.shared}`) }
}
```

### 1.3.5 @Observed / @ObjectLink
- 用于观察class对象的深层属性变化，实现多层嵌套对象的响应式。
- @Observed修饰class，@ObjectLink修饰变量。
- 适合如二维数组、对象嵌套对象等深层结构。

```typescript
@Observed
class Book { name: string }
@Observed
class Bag { book: Book }
@Component
struct BookCard { @ObjectLink book: Book; ... }
```

---

## 1.4 应用级状态管理

### 1.4.1 AppStorage
- 全局唯一，进程绑定，适合全局状态（如用户登录态、主题色等）。
- 组件通过@StorageLink（双向）/@StorageProp（单向）绑定AppStorage中的属性。
- 支持跨页面、跨UIAbility数据同步。

```typescript
AppStorage.SetOrCreate('user', { name: 'Tom' });
@Component
struct Profile {
  @StorageLink('user') userInfo: { name: string } = { name: '' };
  build() { Text(this.userInfo.name) }
}
```

### 1.4.2 LocalStorage
- 支持页面级/局部状态共享（如Tab间共享数据）。
- 通过@LocalStorageLink（双向）/@LocalStorageProp（单向）绑定LocalStorage属性。
- 生命周期与引用的组件树一致。

```typescript
let storage = new LocalStorage();
storage.setOrCreate('counter', 1);
@Entry(storage)
@Component
struct Demo { @LocalStorageLink('counter') value: number = 1; ... }
```

### 1.4.3 PersistentStorage
- AppStorage的属性持久化到磁盘，应用重启后恢复。
- 通过API指定哪些AppStorage属性持久化。

```typescript
PersistentStorage.PersistProp('theme', 'dark');
```

---

## 1.5 状态同步的类型

- 单向同步：@Prop/@StorageProp/@LocalStorageProp，父/源→子/组件。
- 双向同步：@Link/@StorageLink/@LocalStorageLink/@Provide+@Consume，父↔子/组件↔存储。

---

# 二、渲染控制

## 2.1 if/else条件渲染

- 支持在UI声明中直接用if/else进行条件分支，依赖的状态变量变更时自动重渲染。
- 典型用法：控制组件显示/隐藏、切换内容。

```typescript
if (this.count > 0) {
  Text("正数")
} else {
  Text("非正数")
}
```

---

## 2.2 ForEach循环渲染

- 用于数组批量渲染组件，支持可选key生成器（提升性能，避免不必要的重建）。
- itemGenerator为每个数据项生成UI片段。

```typescript
ForEach(this.list, (item: string) => {
  Text(item)
}, (item: string) => item) // key生成器
```

---

## 2.3 LazyForEach懒加载渲染

- 适合大数据量场景，配合List/Grid/Swiper/WaterFlow等滚动容器，只渲染可视区域数据。
- 节省内存、加快渲染。
- 需用DataChangeListener对象及onDataChange机制刷新UI。

---

# 三、ArkTS基础类库

## 3.1 并发与异步

### 3.1.1 异步并发

- **Promise**：标准JS异步对象，支持then/catch链式写法，三种状态（pending/fulfilled/rejected）。
- **async/await**：Promise语法糖，使异步代码更接近同步逻辑，异常可catch。

```typescript
const promise = new Promise((resolve, reject) => { ... });
promise.then(val => ...).catch(err => ...);

async function foo() {
  try {
    const result = await someAsync();
  } catch(e) { ... }
}
```

### 3.1.2 多线程并发

- **TaskPool**、**Worker**：适合CPU密集/IO密集型任务，与UI主线程分离，避免卡顿。

---

## 3.2 容器类库

### 3.2.1 线性容器

- **ArrayList/Vector/List/LinkedList/Deque/Queue/Stack**：丰富的数据结构，支持高效的增、删、查、改。

```typescript
import ArrayList from '@ohos.util.ArrayList';
let arr = new ArrayList();
arr.add('a'); arr.add(1); arr[0] = 'b';
```

---

## 3.3 XML/JSON 等数据处理

### 3.3.1 XML

- 支持XML序列化与解析，基于DataView和XmlSerializer操作。
- 可构造复杂XML文档，支持属性、嵌套元素等。

```typescript
import xml from '@ohos.xml';
let serializer = new xml.XmlSerializer(dataView);
serializer.setDeclaration();
serializer.startElement('book');
serializer.setAttributes('category', 'COOKING');
serializer.endElement();
```

### 3.3.2 JSON

- 扩展原生JSON，支持BigInt、循环引用检测、错误处理。
- parse/stringify用法与原生一致，支持更多高级特性。

---

# 四、典型开发注意事项

- **变量类型必须显式声明**，禁止any/undefined/null初始化。
- **父子组件参数类型需严格一致**，否则同步机制异常。
- **@Link必须从父组件初始化，禁止本地赋值。**
- **@Observed/@ObjectLink用于深层响应式场景**，否则只能观察一层。
- **AppStorage/LocalStorage属性初始化要确保key已存在**，避免取不到数据。
- **LazyForEach请配合DataChangeListener和key生成器**，保证高效渲染。
- **并发操作避免直接操作UI**，UI相关逻辑请在主线程执行。

---

# 五、典型代码/流程示例

````typescript name=state-management-demo.ets
// 全局状态同步与条件渲染
AppStorage.SetOrCreate('theme', 'light');

@Entry
@Component
struct PageA {
  @StorageLink('theme') appTheme: string = 'light';
  build() {
    Text(`当前主题: ${this.appTheme}`)
    Button('切换主题').onClick(() => {
      this.appTheme = this.appTheme === 'light' ? 'dark' : 'light';
    })
  }
}
````

---

如需具体某一类装饰器、状态同步、渲染控制、异步/容器类库等详细代码用法或原理补充，请随时告知！