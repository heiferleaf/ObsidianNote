---
title: tips
created: 2025-10-26 21:49
tags: [课程, 课程学习, 移动开发]
subject: 移动开发
modified: 2025-12-28 12:47
---
1. 函数接受一个可选参数
	```ArkTS
	funciton f1(..., arg ?: number) {}
	这样arg就是可选参数
	```

2. 对于空值的调用
```
对象1?.属性
属性为空不会报错
```

3. 对于可空值不能用于运算，但是 !符号确保不报错
```
let x : number | null = 1;
let y : number;
y = x + 1 // 不行，报错
y = x! + 1 // 可以，这时候说明开发者确定x不是null或者空
```

4. @Component只能用于struct

5. build（）内使用可以使用lambda函数或者匿名函数（给事件用），用匿名函数需要.bind(this)

6. 