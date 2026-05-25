---
title: DAY16 XML Json
created: 2025-12-29
modified: 2026-01-20
tags:
  - 技术栈
subject: JavaEE
---
# XML与JSON数据处理

## 一、XML（可扩展标记语言）

### 1.1 XML基本特征

**核心特性**：
1. **可嵌套层级结构**：适合描述复杂结构化数据
2. **纯文本格式**：支持UTF-8等多种编码
3. **严格语法**：比HTML语法要求更严格
4. **自我描述性**：标签名可自定义，表达数据含义

### 1.2 XML文档结构

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE 文档类型定义>
<!-- 注释：XML有且仅有一个根元素 -->

<根元素>
    <元素 属性名="属性值">
        文本内容
        <子元素>嵌套内容</子元素>
        <空元素标签/>  <!-- 空元素的简写形式 -->
    </元素>
</根元素>
```

**XML语法要求**：
1. **必须有且仅有一个根元素**
2. **所有标签必须闭合**：
   - 成对标签：`<tag>内容</tag>`
   - 空元素标签：`<tag/>`
3. **标签区分大小写**：`<Book>`和`<book>`是不同的标签
4. **属性值必须用引号包围**：`id="1"`或`id='1'`
5. **标签必须正确嵌套**：不能交叉嵌套

### 1.3 XML特殊字符转义

由于XML使用特殊符号作为标记，以下字符需要转义：

| 字符 | 转义序列 | 说明 |
|------|----------|------|
| `<` | `&lt;` | 小于号 |
| `>` | `&gt;` | 大于号 |
| `&` | `&amp;` | 和号 |
| `"` | `&quot;` | 双引号 |
| `'` | `&apos;` | 单引号 |

**示例**：
```xml
<description>比较大小：3 &lt; 5 &amp;&amp; 5 &gt; 3</description>
```

### 1.4 Java文件读取路径注意事项

在Java中读取资源文件时，路径解析方式取决于使用的API：

#### **从磁盘文件系统读取**
```java
// 1. 使用绝对路径
File file1 = new File("/home/user/data.xml");

// 2. 使用相对路径（相对于当前工作目录）
File file2 = new File("data/data.xml");
// 当前工作目录通常是项目根目录或执行目录
```

#### **使用Class.getResourceAsStream()**
```java
// 从类路径（classpath）中读取，相对路径相对于当前类所在的包
InputStream is = MyClass.class.getResourceAsStream("data.xml");
// 在src/main/resources/com/example/目录下查找data.xml
```

#### **使用ClassLoader.getResourceAsStream()**
```java
// 从类路径中读取，相对路径相对于类路径根目录
InputStream is = ClassLoader.getSystemClassLoader()
    .getResourceAsStream("com/example/data.xml");
// 在类路径的com/example/目录下查找data.xml，也就是说，资源文件会从根目录开始朝气，并且，编译器会自己在字符串前加上/，所以我们写的时候，路径前不能加/
```

**关键区别**：
- **磁盘文件**：基于文件系统路径
- **类路径资源**：基于编译后的class文件位置
- 编译器通常会将`src/main/resources/`下的文件复制到输出目录的类路径中

### 1.5 XML解析方式

#### **DOM解析（文档对象模型）**

**工作原理**：一次性加载整个XML文档到内存，构建树形结构

```java
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import java.io.File;

public class DOMExample {
    public static void main(String[] args) throws Exception {
        // 1. 创建DocumentBuilderFactory
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        
        // 2. 创建DocumentBuilder
        DocumentBuilder builder = factory.newDocumentBuilder();
        
        // 3. 解析XML文档
        Document document = builder.parse(new File("data.xml"));
        
		// 4. DFS遍历整个XML文档
		// Document \ Element \ Text \ Attribute， 是Xml文档的元素结构层级，都是Node的子类
		parseNode(document, 0);
    }
    public static void parseNode(Node node, int indent) {
	    for(int i=0; i<indent; i++) System.out.print(" ");  
  
		switch (node.getNodeType()) {  
		    case Node.DOCUMENT_NODE  -> System.out.println("Document type " + node.getNodeName());  
		    case Node.ELEMENT_NODE   -> System.out.println("Element type " + node.getNodeName());  
		    case Node.TEXT_NODE      -> System.out.println("Text type " + node.getNodeName() + " = " + node.getNodeValue());  
		    case Node.ATTRIBUTE_NODE -> System.out.println("Attr type" + node.getNodeName() + " = " + node.getNodeValue());  
		default                      -> System.out.println("Node type " + node.getNodeType() + ", NodeName " + node.getNodeName());  
		}  
		  
		for(Node childNode = node.getFirstChild(); childNode != null; childNode = childNode.getNextSibling()) {  
		    parseNode(childNode, indent + 1);  
		}
    }
}
```

**DOM解析特点**：
- ✅ **优点**：可以随机访问任何节点，支持修改文档结构
- ❌ **缺点**：内存消耗大，不适合大文件
- **适用场景**：小文件或需要频繁修改的XML

#### **SAX解析（简单API for XML）**

**工作原理**：基于事件驱动，边读边解析

```java
import javax.xml.parsers.SAXParser;
import javax.xml.parsers.SAXParserFactory;
import org.xml.sax.Attributes;
import org.xml.sax.SAXException;
import org.xml.sax.helpers.DefaultHandler;

public class SAXExample {
    public static void main(String[] args) throws Exception {
        // 1. 创建SAXParserFactory
        SAXParserFactory factory = SAXParserFactory.newInstance();
        
        // 2. 创建SAXParser
        SAXParser parser = factory.newSAXParser();
        
        // 3. 创建事件处理器
        DefaultHandler handler = new DefaultHandler() {
            boolean inTitle = false;
            StringBuilder currentText = null;
            
            @Override
            public void startElement(String uri, String localName, 
                                     String qName, Attributes attributes) {
                if ("title".equals(qName)) {
                    inTitle = true;
                    currentText = new StringBuilder();
                }
                if ("book".equals(qName)) {
                    String id = attributes.getValue("id");
                    System.out.print("Book " + id + ": ");
                }
            }
            
            @Override
            public void characters(char[] ch, int start, int length) {
                if (inTitle && currentText != null) {
                    currentText.append(ch, start, length);
                }
            }
            
            @Override
            public void endElement(String uri, String localName, String qName) {
                if ("title".equals(qName)) {
                    System.out.println(currentText.toString());
                    inTitle = false;
                    currentText = null;
                }
            }
        };
        
        // 4. 解析XML
        parser.parse("data.xml", handler);
    }
}
```

**SAX解析特点**：
- ✅ **优点**：内存消耗小，适合大文件
- ❌ **缺点**：只能顺序读取，不能随机访问
- **适用场景**：只读的大文件解析

#### **Jackson XML解析（对象映射）**

**工作原理**：将XML直接映射为Java对象

**Maven依赖**：
```xml
<dependency>
    <groupId>com.fasterxml.jackson.dataformat</groupId>
    <artifactId>jackson-dataformat-xml</artifactId>
    <version>2.15.2</version>
</dependency>
```

**完整步骤示例**：
```java
import com.fasterxml.jackson.dataformat.xml.XmlMapper;
import java.io.File;
import java.util.List;

// 1. 定义JavaBean类
class Book {
    private String id;
    private String title;
    private String author;
    private double price;
    
    // 必须有无参构造器
    public Book() {}
    
    // Getter和Setter方法
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    
    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }
    
    public double getPrice() { return price; }
    public void setPrice(double price) { this.price = price; }
    
    @Override
    public String toString() {
        return "Book{id='" + id + "', title='" + title + "', author='" + author + "'}";
    }
}

class Library {
    private List<Book> books;
    
    public List<Book> getBooks() { return books; }
    public void setBooks(List<Book> books) { this.books = books; }
}

public class JacksonXmlExample {
    public static void main(String[] args) throws Exception {
        // 2. 创建XmlMapper
        XmlMapper xmlMapper = new XmlMapper();
        
        // 3. 从XML读取到对象（反序列化）
        Library library = xmlMapper.readValue(
            new File("library.xml"), 
            Library.class
        );
        
        // 4. 处理数据
        for (Book book : library.getBooks()) {
            System.out.println(book);
        }
        
        // 5. 将对象写入XML（序列化）
        Book newBook = new Book();
        newBook.setId("4");
        newBook.setTitle("Java Programming");
        newBook.setAuthor("John Doe");
        newBook.setPrice(49.99);
        
        String xml = xmlMapper.writeValueAsString(newBook);
        System.out.println("生成的XML:\n" + xml);
    }
}
```

**对应的XML文件（library.xml）**：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Library>
    <books>
        <book id="1">
            <title>Java核心技术</title>
            <author>Cay S. Horstmann</author>
            <price>89.9</price>
        </book>
        <book id="2">
            <title>Effective Java</title>
            <author>Joshua Bloch</author>
            <price>79.9</price>
        </book>
    </books>
</Library>
```

**Jackson XML注解示例**：
```java
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlProperty;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlRootElement;

@JacksonXmlRootElement(localName = "book")
class Book {
    @JacksonXmlProperty(isAttribute = true)
    private String id;
    
    @JacksonXmlProperty(localName = "book_title")
    private String title;
    
    // ... 其他属性和方法
}
```

**Jackson XML解析特点**：
- ✅ **优点**：简单易用，自动类型转换
- ✅ **支持注解**：灵活控制映射关系
- ✅ **双向转换**：支持序列化和反序列化
- **要求**：JavaBean需要无参构造器和getter/setter方法

## 二、JSON（JavaScript对象表示法）

### 2.1 JSON与XML对比

| 特性 | JSON | XML |
|------|------|-----|
| **编码** | 默认UTF-8，无编码问题 | 需要声明编码 |
| **格式** | 简单紧凑 | 相对冗长 |
| **浏览器支持** | 原生支持（JavaScript对象） | 需要XML解析器 |
| **数据类型** | 字符串、数字、布尔、数组、对象、null | 所有数据都是文本 |
| **标签** | 键用双引号包围 | 自定义标签名 |
| **转义** | 有限转义字符 | 5个XML实体转义 |

### 2.2 JSON语法规则

```json
{
  "string_key": "字符串值",
  "number_key": 123.45,
  "boolean_key": true,
  "null_key": null,
  "array_key": ["元素1", "元素2", 3],
  "object_key": {
    "nested_key": "嵌套值"
  }
}
```

**JSON语法要求**：
1. **键必须用双引号包围**：`"key"`（单引号无效）
2. **字符串必须用双引号**：`"value"`
3. **支持的原始类型**：
   - 字符串：`"text"`
   - 数字：`123`、`12.34`
   - 布尔值：`true`、`false`
   - 空值：`null`
4. **复合类型**：
   - 数组：`[value1, value2, ...]`
   - 对象：`{"key": "value", ...}`
5. **转义字符**：`\"`、`\\`、`\/`、`\b`、`\f`、`\n`、`\r`、`\t`、`\uXXXX`

### 2.3 Java中的JSON处理

#### **使用Jackson处理JSON**

**Maven依赖**：
```xml
<dependency>
    <groupId>com.fasterxml.jackson.core</groupId>
    <artifactId>jackson-databind</artifactId>
    <version>2.15.2</version>
</dependency>
```

**基本读写示例**：
```java
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.File;
import java.util.*;

public class JacksonJsonExample {
    
    // 定义JavaBean
    static class Person {
        private String name;
        private int age;
        private List<String> hobbies;
        private Map<String, Object> metadata;
        
        // 必须有无参构造器
        public Person() {}
        
        // Getter和Setter
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        
        public int getAge() { return age; }
        public void setAge(int age) { this.age = age; }
        
        public List<String> getHobbies() { return hobbies; }
        public void setHobbies(List<String> hobbies) { this.hobbies = hobbies; }
        
        public Map<String, Object> getMetadata() { return metadata; }
        public void setMetadata(Map<String, Object> metadata) { 
            this.metadata = metadata; 
        }
    }
    
    public static void main(String[] args) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        
        // 1. JSON字符串转对象（反序列化）
        String jsonStr = """
            {
                "name": "张三",
                "age": 25,
                "hobbies": ["阅读", "编程", "音乐"],
                "metadata": {
                    "department": "研发部",
                    "employeeId": "E001"
                }
            }
            """;
        
        Person person = mapper.readValue(jsonStr, Person.class);
        System.out.println("姓名: " + person.getName());
        System.out.println("年龄: " + person.getAge());
        
        // 2. 对象转JSON字符串（序列化）
        Person newPerson = new Person();
        newPerson.setName("李四");
        newPerson.setAge(30);
        newPerson.setHobbies(Arrays.asList("运动", "旅行"));
        
        Map<String, Object> meta = new HashMap<>();
        meta.put("department", "市场部");
        meta.put("level", "高级");
        newPerson.setMetadata(meta);
        
        String jsonOutput = mapper.writerWithDefaultPrettyPrinter()
                                 .writeValueAsString(newPerson);
        System.out.println("生成的JSON:\n" + jsonOutput);
        
        // 3. JSON文件读写
        // 写入文件
        mapper.writeValue(new File("person.json"), newPerson);
        
        // 从文件读取
        Person fromFile = mapper.readValue(new File("person.json"), Person.class);
        System.out.println("从文件读取: " + fromFile.getName());
    }
}
```

#### **JSON注解使用**

```java
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import java.util.Date;

@JsonPropertyOrder({"name", "age", "email"})  // 指定属性顺序
class User {
    @JsonProperty("user_name")  // 指定JSON字段名
    private String name;
    
    private int age;
    
    @JsonIgnore  // 忽略此字段
    private String password;
    
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    private Date birthDate;
    
    // 构造器、getter、setter...
}
```

#### **自定义JSON反序列化**

当JSON格式与Java对象结构不匹配时，可以使用自定义反序列化器。

```java
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import java.io.IOException;

// 1. 定义自定义反序列化器
class PriceDeserializer extends JsonDeserializer<Double> {
    @Override
    public Double deserialize(JsonParser p, DeserializationContext ctxt) 
            throws IOException, JsonProcessingException {
        // 从JSON解析原始值
        String priceStr = p.getText();
        
        // 自定义处理逻辑：移除货币符号，转换类型
        if (priceStr.startsWith("$")) {
            priceStr = priceStr.substring(1);
        } else if (priceStr.endsWith("元")) {
            priceStr = priceStr.substring(0, priceStr.length() - 1);
        }
        
        try {
            return Double.parseDouble(priceStr.trim());
        } catch (NumberFormatException e) {
            throw new IOException("价格格式错误: " + priceStr);
        }
    }
}

// 2. 在JavaBean中使用注解
class Product {
    private String name;
    
    @JsonDeserialize(using = PriceDeserializer.class)
    private double price;
    
    public Product() {}
    
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    
    public double getPrice() { return price; }
    public void setPrice(double price) { this.price = price; }
}

// 3. 使用示例
public class CustomDeserializerExample {
    public static void main(String[] args) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        
        String json1 = "{\"name\":\"手机\",\"price\":\"$599.99\"}";
        String json2 = "{\"name\":\"电脑\",\"price\":\"4599.00元\"}";
        
        Product p1 = mapper.readValue(json1, Product.class);
        Product p2 = mapper.readValue(json2, Product.class);
        
        System.out.println(p1.getName() + ": " + p1.getPrice());  // 手机: 599.99
        System.out.println(p2.getName() + ": " + p2.getPrice());  // 电脑: 4599.0
    }
}
```

### 2.4 JSON处理关键接口函数

#### **ObjectMapper核心方法**

```java
// 序列化（对象 → JSON）
String jsonString = objectMapper.writeValueAsString(obj);
byte[] jsonBytes = objectMapper.writeValueAsBytes(obj);
objectMapper.writeValue(file, obj);
objectMapper.writeValue(outputStream, obj);

// 反序列化（JSON → 对象）
MyClass obj = objectMapper.readValue(jsonString, MyClass.class);
MyClass obj = objectMapper.readValue(jsonBytes, MyClass.class);
MyClass obj = objectMapper.readValue(file, MyClass.class);
MyClass obj = objectMapper.readValue(inputStream, MyClass.class);

// 类型安全的反序列化
JavaType type = objectMapper.getTypeFactory()
    .constructCollectionType(List.class, MyClass.class);
List<MyClass> list = objectMapper.readValue(jsonArrayString, type);

// 泛型类型处理
Map<String, List<MyClass>> map = objectMapper.readValue(
    jsonString,
    new TypeReference<Map<String, List<MyClass>>>() {}
);
```

#### **JsonNode树模型操作**

```java
// 解析为JsonNode（无需预先定义Java类）
JsonNode rootNode = objectMapper.readTree(jsonString);

// 访问节点
String name = rootNode.get("name").asText();
int age = rootNode.get("age").asInt();
boolean active = rootNode.get("active").asBoolean();

// 遍历数组
JsonNode hobbies = rootNode.get("hobbies");
if (hobbies.isArray()) {
    for (JsonNode hobby : hobbies) {
        System.out.println(hobby.asText());
    }
}

// 检查节点存在
if (rootNode.has("email")) {
    String email = rootNode.get("email").asText();
}

// 创建JSON
ObjectNode newNode = objectMapper.createObjectNode();
newNode.put("name", "张三");
newNode.put("age", 25);
ArrayNode arrayNode = objectMapper.createArrayNode();
arrayNode.add("阅读");
arrayNode.add("编程");
newNode.set("hobbies", arrayNode);

String newJson = objectMapper.writeValueAsString(newNode);
```

### 2.5 实际应用注意事项

#### **日期时间处理**

```java
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.time.LocalDate;
import java.time.LocalDateTime;

class Event {
    private String name;
    private LocalDate date;
    private LocalDateTime dateTime;
    
    // getter/setter
}

public class DateExample {
    public static void main(String[] args) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        
        // 注册Java 8时间模块
        mapper.registerModule(new JavaTimeModule());
        
        // 禁用时间戳格式
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        
        Event event = new Event();
        event.setName("会议");
        event.setDate(LocalDate.of(2023, 12, 18));
        event.setDateTime(LocalDateTime.now());
        
        String json = mapper.writeValueAsString(event);
        System.out.println(json);
        // 输出: {"name":"会议","date":"2023-12-18","dateTime":"2023-12-18T10:30:00"}
    }
}
```

#### **处理未知属性**

```java
// 忽略未知属性（JSON中有但Java类中没有的字段）
objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

// 或使用注解
@JsonIgnoreProperties(ignoreUnknown = true)
class MyClass {
    // ...
}
```

#### **空值处理**

```java
// 忽略null值
objectMapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);

// 使用注解
@JsonInclude(JsonInclude.Include.NON_NULL)
class MyClass {
    private String name;  // 如果为null，不会出现在JSON中
    // ...
}
```

## 三、选择XML还是JSON？

### 3.1 使用XML的场景

1. **需要文档验证**：XML有DTD、XSD等验证机制
2. **需要命名空间**：复杂数据结构需要区分不同来源
3. **需要处理混合内容**：文本和标签混合的情况
4. **行业标准要求**：某些行业（如出版、医疗）使用XML标准
5. **需要XPath/XSLT**：复杂的查询和转换需求

### 3.2 使用JSON的场景

1. **Web API**：RESTful API普遍使用JSON
2. **前端交互**：JavaScript原生支持JSON
3. **配置文件**：现代应用配置（如package.json）
4. **数据交换**：移动应用、微服务间通信
5. **性能敏感**：JSON通常比XML更紧凑，解析更快

### 3.3 性能对比

| 方面 | XML | JSON |
|------|-----|------|
| **文件大小** | 较大（标签冗余） | 较小（语法简洁） |
| **解析速度** | 较慢（结构复杂） | 较快（结构简单） |
| **内存占用** | 较高（DOM解析时） | 较低 |
| **浏览器支持** | 需要解析器 | 原生支持 |

## 四、综合示例

### 4.1 配置文件处理

**XML配置文件示例**：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<config>
    <database>
        <url>jdbc:mysql://localhost:3306/mydb</url>
        <username>admin</username>
        <password>secret</password>
        <poolSize>10</poolSize>
    </database>
    <server>
        <port>8080</port>
        <contextPath>/api</contextPath>
    </server>
</config>
```

**JSON配置文件示例**：
```json
{
  "database": {
    "url": "jdbc:mysql://localhost:3306/mydb",
    "username": "admin",
    "password": "secret",
    "poolSize": 10
  },
  "server": {
    "port": 8080,
    "contextPath": "/api"
  }
}
```

### 4.2 数据交换格式

```java
// 企业间数据交换可能使用XML
String xmlOrder = """
    <order id="ORD123">
        <customer>
            <name>ABC公司</name>
            <taxId>91310000100012345X</taxId>
        </customer>
        <items>
            <item sku="P001">
                <name>商品A</name>
                <quantity>10</quantity>
                <unitPrice>29.99</unitPrice>
            </item>
        </items>
        <total>299.90</total>
    </order>
    """;

// 现代Web API使用JSON
String jsonOrder = """
    {
        "orderId": "ORD123",
        "customer": {
            "name": "ABC公司",
            "taxId": "91310000100012345X"
        },
        "items": [
            {
                "sku": "P001",
                "name": "商品A",
                "quantity": 10,
                "unitPrice": 29.99
            }
        ],
        "total": 299.90
    }
    """;
```

### 4.3 迁移建议

如果现有系统使用XML，考虑以下迁移策略：

1. **渐进式迁移**：新功能使用JSON，旧功能保持XML
2. **转换层**：在边界处进行XML-JSON转换
3. **双支持**：API同时支持XML和JSON，通过Content-Type头部区分

## 五、安全注意事项

### 5.1 XML安全问题

1. **XXE攻击**（XML外部实体攻击）
   ```java
   // 不安全
   DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
   
   // 安全配置
   factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
   factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
   factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
   ```

2. **XML注入**：对用户输入进行严格过滤和转义

### 5.2 JSON安全问题

1. **JSON注入**：避免直接将用户输入拼接到JSON中
2. **解析器漏洞**：使用最新版本的解析库
3. **大小限制**：限制JSON输入大小，防止资源耗尽

```java
// 安全配置Jackson
objectMapper.enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION);
objectMapper.disable(JsonParser.Feature.AUTO_CLOSE_SOURCE);
```

## 六、最佳实践总结

1. **优先选择JSON**：对于大多数现代应用
2. **统一编码**：始终使用UTF-8编码
3. **验证输入**：无论是XML还是JSON，都要验证输入数据
4. **使用标准库**：Jackson、Gson等成熟库
5. **考虑性能**：大文件使用SAX或流式JSON解析
6. **合理设计结构**：避免过度嵌套，保持结构清晰
7. **提供文档**：特别是公共API，提供数据格式说明
8. **向后兼容**：修改数据格式时考虑旧版本兼容性