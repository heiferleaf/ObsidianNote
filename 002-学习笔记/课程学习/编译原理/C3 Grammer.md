---
created: 2026-03-31
modified: 2026-04-12
---

> 经过词法分析，可以将源代码的每一个词素，都进行合法性的校验，是否满足否一个模式下的词性，顺带记录词性的作用域等信息


# 上下文无关文法

> 当前考虑的单词只有 ID、PLUS、TIMES、SEMI、LP、RP
> 只包含算数表达式所需的单词

### 递归定义与产生式

语法分析的对象是词法分析得到的具体的单词中的词形，所有的词形，都按照单词的模式名来看待。

- 语法分析对模式的组合进行限制
- 将所有涉及到的模式组成新的字符表 $\Sigma$
- 字符表中所有的元素所有的组合，得到的字符串集合 $\Sigma^*$

现在的需求，找到一个映射方式，将 $\Sigma^*$ 的元素，映射到$Boolean$，表示单词的组合顺序是否合法

通过归纳的方式，找到上面的映射需求：
下面是产生式的定义
$$\begin{aligned}
&\text{expression} \rightarrow \text{expression} \text{ PLUS } \text{term} \\
&\text{expression} \rightarrow \text{term} \\
&\text{term} \rightarrow \text{term} \text{ TIMES } \text{factor} \\
&\text{term} \rightarrow \text{factor} \\
&\text{factor} \rightarrow \text{NUM\_OR\_ID} \\
&\text{factor} \rightarrow \text{LP } \text{expression} \text{ RP}
\end{aligned}$$
## 上下文无关文法 (Context-Free Grammar, CFG)

上下文无关文法是一个四元组 $G = (T, N, S, P)$，其中各部分的数学定义如下：

 1. 形式化定义
$$G = \langle T, N, S, P \rangle$$
- **$T$ (Terminals)**：
    有限字母表，其元素称为**终结符号**。它们是语言中实际出现的字符（如数字、变量名、运算符等）。
- **$N$ (Non-terminals)**：
    有限的语法成分标记集合，称为**非终结符号**。
    - 约束条件：$N \cap T = \emptyset$（非终结符与终结符互斥）。
    - 作用：相当于递归定义中的**元变量**，用于表示语法结构（如 `expression`、`term`）。
- **$S$ (Start Symbol)**：
    文法**开始符号**，且满足 $S \in N$。它是推导的起点。
- **$P$ (Productions)**：
    **产生式**的一个有限集合。
    $$P = \{ S_i \rightarrow w \mid S_i \in N, w \in (T \cup N)^* \}$$
    - 左侧LHS（Left Hand Side） $S_i$ 必须是一个非终结符。
    - 右侧RHS（Right Hand Side） $w$ 是由终结符和非终结符组成的任意有限序列（包括空串 $\epsilon$）。一个非终止符有多个RHS的时候，用 | 连接
1. 示例：简单算术文法的四元组表示
$$\begin{aligned} T &= \{ \text{id}, +, *, (, ) \} \\ N &= \{ E, T, F \} \\ S &= E \\ P &= \{ E \to E+T \mid T, \ T \to T*F \mid F, \ F \to (E) \mid \text{id} \} \end{aligned}$$
> [!NOTE] 闭包逻辑
> 1. $\Sigma^*$: 在语法分析中，表示为词法分析得到的单词的闭包，等价为任意的组合方式 $\Sigma^* = \cup{_{i=0}}{^\infty}$
> 2. $(T \cup N)^*$: 表示终止符和非终止符的闭包，任意个数其中元素的任意顺序排列

### 0步推导、一步推导、n步推到、\*推导

一步推导：假设 G 是CFG，$\alpha A\beta \in (T\cup N)^*$，且 $A \in N, A \to \gamma \in P$，那么 $\alpha A\beta \Rightarrow \alpha \gamma \beta$
其中的 $\alpha \beta$ 是 $A$ 的上下文环境，$\Rightarrow$ 是$(T\cup N)^*$ 上的二元关系

零步推导：$\alpha A \beta \xRightarrow{0} \alpha A \beta$，是 $(T\cup N)^*$ 上的恒等关系

n步推导$\xRightarrow{n}$通过归纳定义，在n-1步推导的基础上，在进行一次推导

$*$推导$\xRightarrow{*}$：推导的闭包运算， $\cup_{i=0}^{\infty}\xRightarrow{i}$
> $*推导$ 是 $(T\cup N)^*$ 上的二元关系 $\Rightarrow$ 的自反传递闭包
> ==离散同款操作==

> **产生式是运算的基础，相当于公理。推导是在产生式的基础上，进行运算的定理**


### 上下文无关语言

- 上下文无关文法的语言：
	设 $G$ 是一个上下文无关文法（CFG），由 $G$ 所生成的语言记作 $L(G)$。
	$$L(G) = \{ \alpha \mid \alpha \in T^* \land S \xRightarrow{*} \alpha \}$$
- 语言的语句
	$$\text{若 } \alpha \in L(G) \text{，则称 } \alpha \text{ 为语言 } L(G) \text{ 的一个语句。}$$
- 上下文无关语言
	$$L \subseteq T^* \text{ 是上下文无关语言 (CFL) } \iff \exists \text{ CFG } G \text{ 使得 } L = L(G)$$
	上下文无关语言可能会有多个对应的 CFG，所以只要求存在一个即可

$$\begin{aligned}
& \textbf{Start Symbol } S \xRightarrow{*} \text{Sentential Form } (\text{包含 } T \text{ 和 } N) \\
& \downarrow \text{ 最终推导 } \\
& \text{Sentence } (\text{仅包含 } T) \in L(G)
\end{aligned}$$
> [!NOTE] 语句和句型
> 1. 句型是 CFG 中，能从开始符号，\*推导出来的所有内容，是 $(T\cup N)^*$的元素
> 2. 语句所包含的元素，都是T，终止结束符，所以说语句是特殊的句型
> 3. 所有的句型，都包含一个字串，是 CFG 中产生式的RHS。==这一点要求，所有的句型，都可以逆向推导，最终回到开始符号==

### 最左推导 (Leftmost Derivation)

每次推导都选择句型中**最左边**的非终结符进行展开，中间得到的所有句型叫做最左句型。

**记法：** $\xRightarrow[*]{lm}$

### 最右推导 (Rightmost Derivation)

每次推导都选择句型中**最右边**的非终结符进行展开，中间得到的所有句型叫做最右句型。

**记法：** $\xRightarrow[*]{rm}$

_最右推导又被称为**规范推导**（Canonical Derivation）。_


## 语法树

CFG 中的开始符号作为树的根节点。设 $A \in N$ 是树的一个结点，$(A \rightarrow X_1X_2\dots X_n ) \in P$，则给A设置n个儿子结点，从左到右编号$X_1,X_2,\dots,X_n$。这样得到的树叫做语法树。语法树的叶子结点都是终止字符，内部阶段都是非中止字符。

- 显然，因为一个 $A \in N$，对应的 $RHS$ 可能有多个，所以根节点相同的语法树会有多个
- 如果在树的构造过程中，每一层的 $A \in N$，在展开儿子节点时，选择的产生式相同，那么得到的树相同，这和最左推导、最右推导，或者推导顺序无关
- **语法树叶子节点从左到右排序，得到的就是语句**
- **当语法树采取相同的推导过程，比如最左推导，但是推导过程中，选取不同的产生式RHS，并且最终得到相同的语句时，称语法树有二义性**==一条语句存在多个不同的语法树==

## CFG 的设计案例

CFG 是没有通用的公式进行设计的，也没有通用的流程判断二义性。
但是一般来说，可以从以下一些规律思考：
1. 递归结构：比如左右对称的文法要求 $S \rightarrow 左字符 S 右字符 | \epsilon$
2. 拼接结构：几段独立的逻辑 $S \rightarrow ABC, A \rightarrow ...$
3. 分支结构：比如 $a^nb^m,n\neq m$，就可以分为 n > m 和 n < m $S\rightarrow A|B$

可以证明，CFG的表达能力强于正则表达式，所以理论上完全可以直接通过语法分析，将字符串解析为语法。之所以借助单词，实现字符串-单词-语法这层抽象，是为了减轻语法分析的负担。


---

# 自顶而下推导 CFG

## LL1 文法的构造

语句具有二义性的一个本质原因： 产生式存在多种重写方式，产生相同的符号开头。
比如 $exp\rightarrow exp\, plus\, term | term$，都可以产生 term 开头的句型

解决方案：使得任意一种非终止符，推导出以某种终止符为首的句型，只有一种方式。

### 直接左递归

**左递归 (Left Recursion)** 是指文法中的非终结符 $A$ 的推导中，第一个符号又是它本身。
- **形式：** $A \to A \alpha$
- **危害：** 会导致自顶向下的语法分析器（如 LL(1) 预测分析器）进入 **死循环**。
- **解决思路：** 将“左递归”转换为“右递归”，改变句型的生成增长方向。
对于一般左递归文法 $$A \to A \alpha_1 \mid A \alpha_2 \mid \dots \mid A \alpha_m \mid \beta_1 \mid \beta_2 \mid \dots \mid \beta_n$$产生的句型 $$L(A) = \{ \beta_i \alpha^k \mid i \in [1, n], k \in \mathbb{N} \}$$引入一个新的非终结符 $A'$，将文法重写为：
1. **确定开始符号：** $A \to \beta_1 A' \mid \beta_2 A' \mid \dots \mid \beta_n A'$
2. **处理递归后缀：** $A' \to \alpha_1 A' \mid \alpha_2 A' \mid \dots \mid \alpha_m A' \mid \varepsilon$

### 间接左递归

$$S \to Aa \mid b$$
$$A \to Ac \mid Sd \mid \varepsilon$$
这种情况下，S 最后还是能推导出$S \to Aa \to (Sd)a = Sda$，这种情况，和直接左递归没区别。
解决方法：
将 $S$ 的定义 $S \to Aa \mid b$ 直接代入到 $A$ 的产生式中替换掉 $S$：
- 原 $A$ 的产生式：$A \to Ac \mid \mathbf{S}d \mid \varepsilon$
- 代入后变为：$A \to Ac \mid (\mathbf{Aa \mid b})d \mid \varepsilon$
- 展开得到：$A \to Ac \mid Aad \mid bd \mid \varepsilon$
> **此时，间接左递归已转化为 $A$ 的直接左递归。**

### 提取左公因子
> 这里解决的是选择选择困难的问题

假设非终结符 $A$ 有多个具有相同前缀 $\alpha$ 的产生式：
$$A \to \alpha \gamma \mid \alpha \delta \mid \beta$$
- $\alpha$：共同的前缀（公因子）。
- $\gamma, \delta$：不同的后缀。
- $\beta$：不以 $\alpha$ 开头的其他备选方案。
提取后的等价文法：
1. **提取公因子：** $A \to \alpha A' \mid \beta$
2. **推迟决策：** $A' \to \gamma \mid \delta$

## 预测算法（使用LL(1) 文法）

> LL(1) 文法：
> - L ：从左到右匹配输入串
> - L ： 匹配的过程中，优先展开左侧的非终止符
> - 1 ：只需要看当前待匹配串的第一个字符，就可以确定重写方案


代码示意：
```
Boolean ll_parse() {
    Stack S;
    S.push('$');
    S.push(Start_Symbol); // 初始化栈
    
    token = getnext();    // 读入第一个符号
    top = S.top();
    
    while (top != '$') {
        if (is_terminal(top)) {
            if (top == token) {
                S.pop();
                token = getnext(); // 匹配消去
            } else {
                return error();    // 终结符不匹配
            }
        } else {
            // 处理非终结符
            if (M[top][token] != error) {
                S.pop();
                push_reverse(M[top][token]); // 反向压栈
            } else {
                return error();    // 查表无对应产生式
            }
        }
        top = S.top();
    }
    
    return (token == '$'); // 最终检查
}
```

### First 集合 、 Follow 集合

这两个集合解决了语法分析中的决策问题：**“面对当前输入，该用哪条产生式？”** ==也就是预测算法中的预测表怎么得到==
1.  **First 集合 (首符号集)**
	- **定义**：对于符号串 $\alpha$，$First(\alpha)$ 是由 $\alpha$ 推导出的所有句型中，可能出现在最左端的**终结符**集合（若能推导出空串，则包含 $\varepsilon$）。
	- **含义**：它代表了一个文法符号“**推导出的开头**”。
	- **数学描述**：$First(\alpha) = \{a \mid a \in T, \alpha \Rightarrow^* a \beta\} \cup \{\varepsilon \mid \text{if } \alpha \xRightarrow{*} \varepsilon\}$
2.   **Follow 集合 (后继符号集)**
	- **定义**：对于非终结符 $A$，$Follow(A)$ 是在所有可能推导出的句型中，紧跟在 $A$ 之后的**终结符**集合。
	- **含义**：它代表了一个非终结符“**身后的环境**”，主要用于处理 $A \to \varepsilon$ 的情况。
	- **数学描述**：$Follow(A) = \{a \mid a \in T, S \xRightarrow{*} \alpha A a \beta\} \cup \{\$ \mid \text{if } S \xRightarrow{*} \alpha A\}$
3. 集合求解方法
	**First(X) 求解逻辑**
	1. **终结符**：若 $X$ 是终结符，则 $First(X) = \{X\}$。
	2. **空串产生式**：若有 $X \to \varepsilon$，则将 $\varepsilon$ 加入 $First(X)$。
	3. **非终结符串 (穿透逻辑)**：若有 $X \to Y_1 Y_2 \dots Y_k$：
	    - 将 $First(Y_1) - \{\varepsilon\}$ 加入 $First(X)$。
	    - 若 $Y_1$ 可推出 $\varepsilon$，则继续看 $Y_2$，以此类推。
	    - 若 $Y_1 \dots Y_k$ 都能推出 $\varepsilon$，则将 $\varepsilon$ 加入 $First(X)$。
	      
	**Follow(A) 求解逻辑**
	1. **开始符号**：将 `$` 放入 $Follow(S)$（$S$ 是开始符号）。
	2. **右邻居贡献**：若有 $A \to \alpha B \beta$，则将 $First(\beta) - \{\varepsilon\}$ 加入 $Follow(B)$。
	3. **边界传递**：若有 $A \to \alpha B$ **或** $A \to \alpha B \beta$ 且 $\beta \Rightarrow^* \varepsilon$：
	    - 将 $Follow(A)$ 的全部内容加入 $Follow(B)$。

### Select 集合

对于产生式 $A \to \alpha$，其 **Select 集合**定义为：在当前的语法分析中，如果非终结符 $A$ 位于栈顶，哪些输入符号 $a$ 可以让我们放心地选择 $A \to \alpha$ 这条产生式进行展开？

根据图中的数学逻辑，Select 集的计算分为两种情况：

- **情况 A：$\alpha$ 不能推导出空串 ($\varepsilon \notin First(\alpha)$)**
    此时，Select 集完全等同于 First 集。
    $$Select(A \to \alpha) = First(\alpha)$$
    _意思是：如果我想用这条规则，我必须在输入里看到它能变出来的那个开头。_
- **情况 B：$\alpha$ 可以推导出空串 ($\varepsilon \in First(\alpha)$)**
    此时，Select 集是 First 集（扣除 $\varepsilon$）与 Follow 集的并集。
    $$Select(A \to \alpha) = (First(\alpha) - \{\varepsilon\}) \cup Follow(A)$$
    _意思是：如果这条规则可以变没，那么输入里出现“我身后的符号”也是合法的。_

需要注意的是，这里的得到的 $Select$ ，不能保证语法顺序错误被第一时间发现，只能保证正确的一定被成功解析

### LL(1) 文法的产生条件

不是所有的文法，经过上述的文法转换和 First 、Follow、Select 推导之后，都能得到无二义性的语句匹配的语法树。也就是任意的 $Select(A \rightarrow \alpha) \cap Select(A \rightarrow \beta)=\phi$

对于每一个产生式 $A \rightarrow \alpha | \beta$ 需要满足以下条件
1. $\alpha$ , $\beta$ 没有相同的前缀 ，即$First(\alpha) \cap First(\beta) = \phi$，进而对于Select不会一定出错
2.  $\alpha$ , $\beta$ 不能同时推导出空，对应$Select(A \to \alpha) = (First(\alpha) - \{\varepsilon\}) \cup Follow(A)$会包含$Follow(A)$
3. 当 $\alpha$ 推导出空串，要求 $First(\beta) \cap Follow(A) = \phi$

### 同步符号

同步符号是语法分析的恢复阶段使用的机制。作用是尽可能多的检查出所有的语法错误。

当预测算法的栈顶，在预测表中无法匹配当前符号进行重写、推导，通过栈顶符号的Follow后随符号集，作为同步符号，在匹配符号不是同步符号中，直接跳过。

>如果不采取这种机制，只能找到第一处的错误