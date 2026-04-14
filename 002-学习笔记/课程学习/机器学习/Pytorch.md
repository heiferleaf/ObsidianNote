---
title: Pytorch
created: 2025-08-09 10:52
tags: [课程, 课程学习, 机器学习]
subject: 机器学习
modified: 2025-12-28 12:47
---
> 本文由 [简悦 SimpRead](http://ksria.com/simpread/) 转码， 原文地址 [www.runoob.com](https://www.runoob.com/pytorch/pytorch-tensor.html)

> PyTorch 张量（Tensor） 张量是一个多维数组，可以是标量、向量、矩阵或更高维度的数据结构。

张量是一个多维数组，可以是标量、向量、矩阵或更高维度的数据结构。

在 PyTorch 中，张量（Tensor）是数据的核心表示形式，类似于 NumPy 的多维数组，但具有更强大的功能，例如支持 GPU 加速和自动梯度计算。

张量支持多种数据类型（整型、浮点型、布尔型等）。

张量可以存储在 CPU 或 GPU 中，GPU 张量可显著加速计算。

下图展示了不同维度的张量（Tensor）在 PyTorch 中的表示方法：

![](https://www.runoob.com/wp-content/uploads/2024/12/1__D5ZvufDS38WkhK9rK32hQ.jpg)

**说明：**

*   **1D Tensor / Vector（一维张量 / 向量）:** 最基本的张量形式，可以看作是一个数组，图中的例子是一个包含 10 个元素的向量。
*   **2D Tensor / Matrix（二维张量 / 矩阵）:** 二维数组，通常用于表示矩阵，图中的例子是一个 4x5 的矩阵，包含了 20 个元素。
*   **3D Tensor / Cube（三维张量 / 立方体）:** 三维数组，可以看作是由多个矩阵堆叠而成的立方体，图中的例子展示了一个 3x4x5 的立方体，其中每个 5x5 的矩阵代表立方体的一个 "层"。
*   **4D Tensor / Vector of Cubes（四维张量 / 立方体向量）:** 四维数组，可以看作是由多个立方体组成的向量，图中的例子没有具体数值，但可以理解为一个包含多个 3D 张量的集合。
*   **5D Tensor / Matrix of Cubes（五维张量 / 立方体矩阵）:** 五维数组，可以看作是由多个 4D 张量组成的矩阵，图中的例子同样没有具体数值，但可以理解为一个包含多个 4D 张量的集合。

* * *

创建张量
----

张量创建的方式有：

<table><thead><tr><th><strong>方法</strong></th><th><strong>说明</strong></th><th><strong>示例代码</strong></th></tr></thead><tbody><tr><td><code>torch.tensor(data)</code></td><td>从 Python 列表或 NumPy 数组创建张量。</td><td><code>x = torch.tensor([[1, 2], [3, 4]])</code></td></tr><tr><td><code>torch.zeros(size)</code></td><td>创建一个全为零的张量。</td><td><code>x = torch.zeros((2, 3))</code></td></tr><tr><td><code>torch.ones(size)</code></td><td>创建一个全为 1 的张量。</td><td><code>x = torch.ones((2, 3))</code></td></tr><tr><td><code>torch.empty(size)</code></td><td>创建一个未初始化的张量。</td><td><code>x = torch.empty((2, 3))</code></td></tr><tr><td><code>torch.rand(size)</code></td><td>创建一个服从均匀分布的随机张量，值在 <code>[0, 1)</code>。</td><td><code>x = torch.rand((2, 3))</code></td></tr><tr><td><code>torch.randn(size)</code></td><td>创建一个服从正态分布的随机张量，均值为 0，标准差为 1。</td><td><code>x = torch.randn((2, 3))</code></td></tr><tr><td><code>torch.arange(start, end, step)</code></td><td>创建一个一维序列张量，类似于 Python 的 <code>range</code>。</td><td><code>x = torch.arange(0, 10, 2)</code></td></tr><tr><td><code>torch.linspace(start, end, steps)</code></td><td>创建一个在指定范围内等间隔的序列张量。</td><td><code>x = torch.linspace(0, 1, 5)</code></td></tr><tr><td><code>torch.eye(size)</code></td><td>创建一个单位矩阵（对角线为 1，其他为 0）。</td><td><code>x = torch.eye(3)</code></td></tr><tr><td><code>torch.from_numpy(ndarray)</code></td><td>将 NumPy 数组转换为张量。</td><td><code>x = torch.from_numpy(np.array([1, 2, 3]))</code></td></tr></tbody></table>

使用 torch.tensor() 函数，你可以将一个列表或数组转换为张量：

实例
--

import torch

tensor = torch.tensor([1, 2, 3])  
print(tensor)  

输出如下：

```
tensor([1, 2, 3])
```

如果你有一个 NumPy 数组，可以使用 torch.from_numpy() 将其转换为张量：

实例
--

import numpy as np

np_array = np.array([1, 2, 3])  
tensor = torch.from_numpy(np_array)  
print(tensor)  

输出如下：

```
tensor([1, 2, 3])
```

创建 2D 张量（矩阵）：

实例
--

import torch

tensor_2d = torch.tensor([  
    [-9, 4, 2, 5, 7],  
    [3, 0, 12, 8, 6],  
    [1, 23, -6, 45, 2],  
    [22, 3, -1, 72, 6]  
])  
print("2D Tensor (Matrix):\n", tensor_2d)  
print("Shape:", tensor_2d.shape)  # 形状  

输出如下：

```
2D Tensor (Matrix):
 tensor([[-9,  4,  2,  5,  7],
        [ 3,  0, 12,  8,  6],
        [ 1, 23, -6, 45,  2],
        [22,  3, -1, 72,  6]])
Shape: torch.Size([4, 5])
```

其他维度的创建：

```
# 创建 3D 张量（立方体）
tensor_3d = torch.stack([tensor_2d, tensor_2d + 10, tensor_2d - 5])  # 堆叠 3 个 2D 张量
print("3D Tensor (Cube):\n", tensor_3d)
print("Shape:", tensor_3d.shape)  # 形状

# 创建 4D 张量（向量的立方体）
tensor_4d = torch.stack([tensor_3d, tensor_3d + 100])  # 堆叠 2 个 3D 张量
print("4D Tensor (Vector of Cubes):\n", tensor_4d)
print("Shape:", tensor_4d.shape)  # 形状

# 创建 5D 张量（矩阵的立方体）
tensor_5d = torch.stack([tensor_4d, tensor_4d + 1000])  # 堆叠 2 个 4D 张量
print("5D Tensor (Matrix of Cubes):\n", tensor_5d)
print("Shape:", tensor_5d.shape)  # 形状
```

* * *

张量的属性
-----

张量的属性如下表：

<table><thead><tr><th><strong>属性</strong></th><th><strong>说明</strong></th><th><strong>示例</strong></th></tr></thead><tbody><tr><td><code>.shape</code></td><td>获取张量的形状</td><td><code>tensor.shape</code></td></tr><tr><td><code>.size()</code></td><td>获取张量的形状</td><td><code>tensor.size()</code></td></tr><tr><td><code>.dtype</code></td><td>获取张量的数据类型</td><td><code>tensor.dtype</code></td></tr><tr><td><code>.device</code></td><td>查看张量所在的设备 (CPU/GPU)</td><td><code>tensor.device</code></td></tr><tr><td><code>.dim()</code></td><td>获取张量的维度数</td><td><code>tensor.dim()</code></td></tr><tr><td><code>.requires_grad</code></td><td>是否启用梯度计算</td><td><code>tensor.requires_grad</code></td></tr><tr><td><code>.numel()</code></td><td>获取张量中的元素总数</td><td><code>tensor.numel()</code></td></tr><tr><td><code>.is_cuda</code></td><td>检查张量是否在 GPU 上</td><td><code>tensor.is_cuda</code></td></tr><tr><td><code>.T</code></td><td>获取张量的转置（适用于 2D 张量）</td><td><code>tensor.T</code></td></tr><tr><td><code>.item()</code></td><td>获取单元素张量的值</td><td><code>tensor.item()</code></td></tr><tr><td><code>.is_contiguous()</code></td><td>检查张量是否连续存储</td><td><code>tensor.is_contiguous()</code></td></tr></tbody></table>

实例
--

import torch

# 创建一个 2D 张量  
tensor = torch.tensor([[1, 2, 3], [4, 5, 6]], dtype=torch.float32)

# 张量的属性  
print("Tensor:\n", tensor)  
print("Shape:", tensor.shape)  # 获取形状  
print("Size:", tensor.size())  # 获取形状（另一种方法）  
print("Data Type:", tensor.dtype)  # 数据类型  
print("Device:", tensor.device)  # 设备  
print("Dimensions:", tensor.dim())  # 维度数  
print("Total Elements:", tensor.numel())  # 元素总数  
print("Requires Grad:", tensor.requires_grad)  # 是否启用梯度  
print("Is CUDA:", tensor.is_cuda)  # 是否在 GPU 上  
print("Is Contiguous:", tensor.is_contiguous())  # 是否连续存储

# 获取单元素值  
single_value = torch.tensor(42)  
print("Single Element Value:", single_value.item())

# 转置张量  
tensor_T = tensor.T  
print("Transposed Tensor:\n", tensor_T)  

输出结果：

```
Tensor:
 tensor([[1., 2., 3.],
         [4., 5., 6.]])
Shape: torch.Size([2, 3])
Size: torch.Size([2, 3])
Data Type: torch.float32
Device: cpu
Dimensions: 2
Total Elements: 6
Requires Grad: False
Is CUDA: False
Is Contiguous: True
Single Element Value: 42
Transposed Tensor:
 tensor([[1., 4.],
         [2., 5.],
         [3., 6.]])
```

* * *

张量的操作
-----

张量操作方法说明如下。

#### 基础操作：

<table><thead><tr><th><strong>操作</strong></th><th><strong>说明</strong></th><th><strong>示例代码</strong></th></tr></thead><tbody><tr><td><code>+</code>, <code>-</code>, <code>*</code>, <code>/</code></td><td>元素级加法、减法、乘法、除法。</td><td><code>z = x + y</code></td></tr><tr><td><code>torch.matmul(x, y)</code></td><td>矩阵乘法。</td><td><code>z = torch.matmul(x, y)</code></td></tr><tr><td><code>torch.dot(x, y)</code></td><td>向量点积（仅适用于 1D 张量）。</td><td><code>z = torch.dot(x, y)</code></td></tr><tr><td><code>torch.sum(x)</code></td><td>求和。</td><td><code>z = torch.sum(x)</code></td></tr><tr><td><code>torch.mean(x)</code></td><td>求均值。</td><td><code>z = torch.mean(x)</code></td></tr><tr><td><code>torch.max(x)</code></td><td>求最大值。</td><td><code>z = torch.max(x)</code></td></tr><tr><td><code>torch.min(x)</code></td><td>求最小值。</td><td><code>z = torch.min(x)</code></td></tr><tr><td><code>torch.argmax(x, dim)</code></td><td>返回最大值的索引（指定维度）。</td><td><code>z = torch.argmax(x, dim=1)</code></td></tr><tr><td><code>torch.softmax(x, dim)</code></td><td>计算 softmax（指定维度）。</td><td><code>z = torch.softmax(x, dim=1)</code></td></tr></tbody></table>

#### **形状操作**

<table><thead><tr><th><strong>操作</strong></th><th><strong>说明</strong></th><th><strong>示例代码</strong></th></tr></thead><tbody><tr><td><code>x.view(shape)</code></td><td>改变张量的形状（不改变数据）。</td><td><code>z = x.view(3, 4)</code></td></tr><tr><td><code>x.reshape(shape)</code></td><td>类似于 <code>view</code>，但更灵活。</td><td><code>z = x.reshape(3, 4)</code></td></tr><tr><td><code>x.t()</code></td><td>转置矩阵。</td><td><code>z = x.t()</code></td></tr><tr><td><code>x.unsqueeze(dim)</code></td><td>在指定维度添加一个维度。</td><td><code>z = x.unsqueeze(0)</code></td></tr><tr><td><code>x.squeeze(dim)</code></td><td>去掉指定维度为 1 的维度。</td><td><code>z = x.squeeze(0)</code></td></tr><tr><td><code>torch.cat((x, y), dim)</code></td><td>按指定维度连接多个张量。</td><td><code>z = torch.cat((x, y), dim=1)</code></td></tr></tbody></table>

实例
--

import torch

# 创建一个 2D 张量  
tensor = torch.tensor([[1, 2, 3], [4, 5, 6]], dtype=torch.float32)  
print(" 原始张量:\n", tensor)

# 1. ** 索引和切片操作 **  
print("\n【索引和切片】")  
print("获取第一行:", tensor[0])  # 获取第一行  
print("获取第一行第一列的元素:", tensor[0, 0])  # 获取特定元素  
print("获取第二列的所有元素:", tensor[:, 1])  # 获取第二列所有元素

# 2. ** 形状变换操作 **  
print("\n【形状变换】")  
reshaped = tensor.view(3, 2)  # 改变张量形状为 3x2  
print(" 改变形状后的张量:\n", reshaped)  
flattened = tensor.flatten()  # 将张量展平成一维  
print(" 展平后的张量:\n", flattened)

# 3. ** 数学运算操作 **  
print("\n【数学运算】")  
tensor_add = tensor + 10  # 张量加法  
print(" 张量加 10:\n", tensor_add)  
tensor_mul = tensor * 2  # 张量乘法  
print(" 张量乘 2:\n", tensor_mul)  
tensor_sum = tensor.sum()  # 计算所有元素的和  
print("张量元素的和:", tensor_sum.item())

# 4. ** 与其他张量的操作 **  
print("\n【与其他张量操作】")  
tensor2 = torch.tensor([[1, 1, 1], [1, 1, 1]], dtype=torch.float32)  
print(" 另一个张量:\n", tensor2)  
tensor_dot = torch.matmul(tensor, tensor2.T)  # 张量矩阵乘法  
print(" 矩阵乘法结果:\n", tensor_dot)

# 5. ** 条件判断和筛选 **  
print("\n【条件判断和筛选】")  
mask = tensor > 3  # 创建一个布尔掩码  
print(" 大于 3 的元素的布尔掩码:\n", mask)  
filtered_tensor = tensor[tensor > 3]  # 筛选出符合条件的元素  
print(" 大于 3 的元素:\n", filtered_tensor)  

输出结果：

```
原始张量:
 tensor([[1., 2., 3.],
         [4., 5., 6.]])

【索引和切片】
获取第一行: tensor([1., 2., 3.])
获取第一行第一列的元素: tensor(1.)
获取第二列的所有元素: tensor([2., 5.])

【形状变换】
改变形状后的张量:
 tensor([[1., 2.],
         [3., 4.],
         [5., 6.]])
展平后的张量:
 tensor([1., 2., 3., 4., 5., 6.])

【数学运算】
张量加 10:
 tensor([[11., 12., 13.],
         [14., 15., 16.]])
张量乘 2:
 tensor([[ 2.,  4.,  6.],
         [ 8., 10., 12.]])
张量元素的和: 21.0

【与其他张量操作】
另一个张量:
 tensor([[1., 1., 1.],
         [1., 1., 1.]])
矩阵乘法结果:
 tensor([[ 6.,  6.],
         [15., 15.]])

【条件判断和筛选】
大于 3 的元素的布尔掩码:
 tensor([[False, False, False],
         [ True,  True,  True]])
大于 3 的元素:
 tensor([4., 5., 6.])
```

* * *

张量的 GPU 加速
----------

将张量转移到 GPU：

```
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
x = torch.tensor([1.0, 2.0, 3.0], device=device)
```

检查 GPU 是否可用：

```
torch.cuda.is_available()  # 返回 True 或 False
```

* * *

张量与 NumPy 的互操作
--------------

张量与 NumPy 的互操作如下表所示：

<table><thead><tr><th><strong>操作</strong></th><th><strong>说明</strong></th><th><strong>示例代码</strong></th></tr></thead><tbody><tr><td><code>torch.from_numpy(ndarray)</code></td><td>将 NumPy 数组转换为张量。</td><td><code>x = torch.from_numpy(np_array)</code></td></tr><tr><td><code>x.numpy()</code></td><td>将张量转换为 NumPy 数组（仅限 CPU 张量）。</td><td><code>np_array = x.numpy()</code></td></tr></tbody></table>

实例
--

import torch  
import numpy as np

# 1. NumPy 数组转换为 PyTorch 张量  
print("1. NumPy 转为 PyTorch 张量")  
numpy_array = np.array([[1, 2, 3], [4, 5, 6]])  
print("NumPy 数组:\n", numpy_array)

# 使用 torch.from_numpy() 将 NumPy 数组转换为张量  
tensor_from_numpy = torch.from_numpy(numpy_array)  
print(" 转换后的 PyTorch 张量:\n", tensor_from_numpy)

# 修改 NumPy 数组，观察张量的变化（共享内存）  
numpy_array[0, 0] = 100  
print(" 修改后的 NumPy 数组:\n", numpy_array)  
print("PyTorch 张量也会同步变化:\n", tensor_from_numpy)

# 2. PyTorch 张量转换为 NumPy 数组  
print("\n2. PyTorch 张量转为 NumPy 数组 ")  
tensor = torch.tensor([[7, 8, 9], [10, 11, 12]], dtype=torch.float32)  
print("PyTorch 张量:\n", tensor)

# 使用 tensor.numpy() 将张量转换为 NumPy 数组  
numpy_from_tensor = tensor.numpy()  
print(" 转换后的 NumPy 数组:\n", numpy_from_tensor)

# 修改张量，观察 NumPy 数组的变化（共享内存）  
tensor[0, 0] = 77  
print(" 修改后的 PyTorch 张量:\n", tensor)  
print("NumPy 数组也会同步变化:\n", numpy_from_tensor)

# 3. 注意：不共享内存的情况（需要复制数据）  
print("\n3. 使用 clone() 保证独立数据 ")  
tensor_independent = torch.tensor([[13, 14, 15], [16, 17, 18]], dtype=torch.float32)  
numpy_independent = tensor_independent.clone().numpy()  # 使用 clone 复制数据  
print(" 原始张量:\n", tensor_independent)  
tensor_independent[0, 0] = 0  # 修改张量数据  
print(" 修改后的张量:\n", tensor_independent)  
print("NumPy 数组（不会同步变化）:\n", numpy_independent)  

输出结果：

```
1. NumPy 转为 PyTorch 张量
NumPy 数组:
 [[1 2 3]
 [4 5 6]]
转换后的 PyTorch 张量:
 tensor([[1, 2, 3],
         [4, 5, 6]])

修改后的 NumPy 数组:
 [[100   2   3]
 [  4   5   6]]
PyTorch 张量也会同步变化:
 tensor([[100,   2,   3],
         [  4,   5,   6]])

2. PyTorch 张量转为 NumPy 数组
PyTorch 张量:
 tensor([[ 7.,  8.,  9.],
         [10., 11., 12.]])
转换后的 NumPy 数组:
 [[ 7.  8.  9.]
 [10. 11. 12.]]

修改后的 PyTorch 张量:
 tensor([[77.,  8.,  9.],
         [10., 11., 12.]])
NumPy 数组也会同步变化:
 [[77.  8.  9.]
 [10. 11. 12.]]

3. 使用 clone() 保证独立数据
原始张量:
 tensor([[13., 14., 15.],
         [16., 17., 18.]])
修改后的张量:
 tensor([[ 0., 14., 15.],
         [16., 17., 18.]])
NumPy 数组（不会同步变化）:
 [[13. 14. 15.]
 [16. 17. 18.]]
```