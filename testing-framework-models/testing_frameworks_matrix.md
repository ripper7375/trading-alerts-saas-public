# Testing Technologies by Development Stack and Stage

## Testing Framework Matrix

| Stage           | Frontend (React/Vue/Angular)                                                                                                                                                    | Backend (Node.js)                                                                                                 | Backend (Python)                                                                                              | Backend (Java)                                                                                       | Backend (.NET)                                                                                                                   | Mobile (React Native)                                                                                      | Mobile (iOS)                                                                                                      | Mobile (Android)                                                                                                | Database                                                                                                                        | DevOps/Infrastructure                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **LOCAL**       | **Unit + Component Testing**                                                                                                                                                    | **Unit Testing**                                                                                                  | **Unit Testing**                                                                                              | **Unit Testing**                                                                                     | **Unit Testing**                                                                                                                 | **Unit Testing**                                                                                           | **Unit Testing**                                                                                                  | **Unit Testing**                                                                                                | **Schema/Migration Testing**                                                                                                    | **Infrastructure as Code Testing**                                                                                                   |
|                 | • Jest + React Testing Library<br>• Vitest + Testing Library<br>• Vue Test Utils (Vue)<br>• Karma + Jasmine (Angular)<br>• Storybook (component stories)<br>• MSW (API mocking) | • Jest<br>• Mocha + Chai<br>• Ava<br>• Vitest<br>• Sinon (mocking)<br>• Supertest (API testing)                   | • pytest<br>• unittest<br>• nose2<br>• mock/unittest.mock<br>• factory_boy (fixtures)<br>• requests-mock      | • JUnit 5<br>• TestNG<br>• Mockito<br>• AssertJ<br>• WireMock<br>• Testcontainers                    | • xUnit<br>• NUnit<br>• MSTest<br>• Moq<br>• AutoFixture<br>• FluentAssertions                                                   | • Jest + React Native Testing Library<br>• Detox (setup)<br>• Metro bundler testing<br>• React Native Mock | • XCTest<br>• Quick + Nimble<br>• OCMock<br>• Xcode Test Plans<br>• iOS Simulator testing                         | • JUnit 4/5<br>• Espresso (setup)<br>• Mockito<br>• Robolectric<br>• Android Test Orchestrator                  | • Flyway (migrations)<br>• Liquibase<br>• dbUnit<br>• SQLAlchemy testing<br>• Entity Framework testing<br>• In-memory databases | • Terraform validate<br>• Ansible syntax check<br>• Docker Compose validation<br>• Kubernetes dry-run<br>• CloudFormation validation |
| **DEVELOPMENT** | **Integration Testing**                                                                                                                                                         | **API + Integration Testing**                                                                                     | **API + Integration Testing**                                                                                 | **API + Integration Testing**                                                                        | **API + Integration Testing**                                                                                                    | **Device Testing**                                                                                         | **Device Testing**                                                                                                | **Device Testing**                                                                                              | **Database Integration**                                                                                                        | **Environment Testing**                                                                                                              |
|                 | • Cypress (component testing)<br>• Playwright (component)<br>• Testing Library queries<br>• MSW (integration scenarios)<br>• Webpack Bundle Analyzer                            | • Supertest<br>• Frisby.js<br>• Newman (Postman CLI)<br>• Artillery (load)<br>• Nock (HTTP mocking)               | • requests + pytest<br>• HTTPretty<br>• pytest-httpserver<br>• locust (load testing)<br>• FastAPI TestClient  | • REST Assured<br>• WireMock<br>• Testcontainers<br>• Spring Boot Test<br>• MockWebServer            | • ASP.NET Core TestServer<br>• WebApplicationFactory<br>• WireMock.NET<br>• NBomber (load)<br>• Microsoft.AspNetCore.Mvc.Testing | • Detox<br>• Appium<br>• React Native debugger<br>• Flipper integration<br>• Metro Inspector               | • iOS Simulator<br>• Xcode Instruments<br>• Network Link Conditioner<br>• iOS Device testing<br>• TestFlight beta | • Android Emulator<br>• Firebase Test Lab<br>• Android Device testing<br>• Genymotion<br>• Android Debug Bridge | • Testcontainers<br>• Docker databases<br>• Database fixtures<br>• Migration testing<br>• Data seeding scripts                  | • Docker testing<br>• Container scanning<br>• Terraform plan<br>• Ansible testing<br>• Infrastructure validation                     |
| **STAGING**     | **E2E + Cross-browser**                                                                                                                                                         | **Load + Performance**                                                                                            | **Load + Performance**                                                                                        | **Load + Performance**                                                                               | **Load + Performance**                                                                                                           | **App Store Testing**                                                                                      | **App Store Testing**                                                                                             | **App Store Testing**                                                                                           | **Performance Testing**                                                                                                         | **Security + Compliance**                                                                                                            |
|                 | • Playwright<br>• Cypress<br>• Selenium WebDriver<br>• Puppeteer<br>• BrowserStack<br>• Sauce Labs<br>• Percy (visual testing)<br>• Chromatic (Storybook)                       | • Artillery.js<br>• k6<br>• Apache Bench<br>• Clinic.js (profiling)<br>• 0x (flame graphs)                        | • locust<br>• pytest-benchmark<br>• Apache Bench<br>• py-spy (profiling)<br>• memory_profiler                 | • JMeter<br>• Gatling<br>• JProfiler<br>• VisualVM<br>• Apache Bench<br>• Testcontainers performance | • NBomber<br>• Visual Studio Diagnostic Tools<br>• PerfView<br>• dotMemory<br>• Application Insights                             | • Detox E2E<br>• Appium<br>• Firebase Test Lab<br>• AWS Device Farm<br>• BrowserStack App Testing          | • XCUITest<br>• Appium<br>• Firebase Test Lab<br>• AWS Device Farm<br>• TestFlight testing                        | • Espresso<br>• UI Automator<br>• Appium<br>• Firebase Test Lab<br>• AWS Device Farm                            | • Apache Bench (DB)<br>• pgbench (PostgreSQL)<br>• MySQL Benchmark<br>• Database stress testing<br>• Query performance analysis | • OWASP ZAP<br>• Nessus<br>• Trivy (container scanning)<br>• Clair<br>• Security compliance checks                                   |
| **PRODUCTION**  | **Real User Monitoring**                                                                                                                                                        | **APM + Monitoring**                                                                                              | **APM + Monitoring**                                                                                          | **APM + Monitoring**                                                                                 | **APM + Monitoring**                                                                                                             | **Crash Reporting**                                                                                        | **Crash Reporting**                                                                                               | **Crash Reporting**                                                                                             | **Database Monitoring**                                                                                                         | **Infrastructure Monitoring**                                                                                                        |
|                 | • Sentry<br>• LogRocket<br>• FullStory<br>• Hotjar<br>• Google Analytics<br>• Core Web Vitals<br>• Lighthouse CI<br>• New Relic Browser                                         | • New Relic<br>• Datadog<br>• AppDynamics<br>• Elastic APM<br>• Sentry<br>• Winston (logging)<br>• Pino (logging) | • New Relic<br>• Datadog<br>• Sentry<br>• APM tools<br>• structlog<br>• Python logging<br>• Prometheus client | • New Relic<br>• AppDynamics<br>• Datadog<br>• Elastic APM<br>• Micrometer<br>• Logback<br>• SLF4J   | • Application Insights<br>• New Relic<br>• Datadog<br>• Serilog<br>• NLog<br>• ETW (Event Tracing)<br>• PerfCounters             | • Sentry React Native<br>• Bugsnag<br>• Crashlytics<br>• Flipper<br>• React Native Performance             | • Crashlytics<br>• Sentry<br>• Bugsnag<br>• Xcode Organizer<br>• MetricKit<br>• OSLog                             | • Crashlytics<br>• Sentry<br>• Bugsnag<br>• Android Vitals<br>• Firebase Performance<br>• Systrace              | • PostgreSQL monitoring<br>• MySQL Performance Schema<br>• MongoDB Compass<br>• Redis monitoring<br>• Database health checks    | • Prometheus + Grafana<br>• CloudWatch<br>• Datadog Infrastructure<br>• Nagios<br>• Zabbix<br>• ELK Stack                            |

---

## Technology-Specific Testing Patterns

### **Frontend Framework Specifics**

#### React Ecosystem

```javascript
// Local Stage
Jest + React Testing Library + MSW
// Development Stage
Cypress component testing + Storybook
// Staging Stage
Playwright + Percy visual testing
// Production Stage
Sentry + LogRocket + Core Web Vitals
```

#### Vue.js Ecosystem

```javascript
// Local Stage
Vue Test Utils + Jest + Vue Testing Library
// Development Stage
Cypress + Vue DevTools
// Staging Stage
Playwright + Chromatic
// Production Stage
Sentry + Vue DevTools production
```

#### Angular Ecosystem

```javascript
// Local Stage
Karma + Jasmine + Angular Testing Utilities
// Development Stage
Protractor (legacy) or Playwright
// Staging Stage
Playwright + Angular DevKit
// Production Stage
Angular Service Worker + Sentry
```

### **Backend Framework Specifics**

#### Node.js + Express

```javascript
// Local: Jest + Supertest
// Development: Artillery + Newman
// Staging: k6 + Clinic.js
// Production: New Relic + Winston
```

#### Python + Django/FastAPI

```python
# Local: pytest + factory_boy
# Development: pytest + httpx/requests
# Staging: locust + pytest-benchmark
# Production: Sentry + structlog
```

#### Java + Spring Boot

```java
// Local: JUnit 5 + Mockito + @SpringBootTest
// Development: REST Assured + Testcontainers
// Staging: Gatling + Spring Boot Actuator
// Production: Micrometer + New Relic
```

#### .NET Core

```csharp
// Local: xUnit + Moq + WebApplicationFactory
// Development: ASP.NET Core TestServer
// Staging: NBomber + Application Insights
// Production: Serilog + Application Insights
```

### **Mobile Platform Specifics**

#### React Native

```javascript
// Local: Jest + React Native Testing Library
// Development: Detox + Flipper
// Staging: Appium + Firebase Test Lab
// Production: Crashlytics + Sentry
```

#### Native iOS

```swift
// Local: XCTest + Quick/Nimble
// Development: iOS Simulator + Network Link Conditioner
// Staging: XCUITest + TestFlight
// Production: Crashlytics + MetricKit
```

#### Native Android

```java
// Local: JUnit + Espresso + Robolectric
// Development: Android Emulator + ADB
// Staging: Firebase Test Lab + UI Automator
// Production: Crashlytics + Android Vitals
```

---

## Database Technology Matrix

| Database Type  | Local Testing            | Development Testing    | Staging Testing             | Production Monitoring          |
| -------------- | ------------------------ | ---------------------- | --------------------------- | ------------------------------ |
| **PostgreSQL** | pg_prove, pgTAP          | Testcontainers, Docker | pgbench, pg_stat_statements | pg_stat_monitor, Prometheus    |
| **MySQL**      | MySQL Test Framework     | Docker MySQL, fixtures | MySQL Benchmark Suite       | Performance Schema, PMM        |
| **MongoDB**    | mongodb-memory-server    | Docker MongoDB         | MongoDB Profiler            | MongoDB Compass, Ops Manager   |
| **Redis**      | redis-mock, ioredis-mock | Docker Redis           | redis-benchmark             | Redis monitoring, RedisInsight |
| **SQLite**     | In-memory SQLite         | File-based SQLite      | N/A (not for production)    | N/A                            |

---

## DevOps/Infrastructure Testing Matrix

| Infrastructure Type | Local Testing      | Development Testing | Staging Testing           | Production Monitoring |
| ------------------- | ------------------ | ------------------- | ------------------------- | --------------------- |
| **Kubernetes**      | kind, minikube     | kubectl dry-run     | Chaos engineering         | Prometheus + Grafana  |
| **Docker**          | Docker testing     | Container scanning  | Security scanning         | Container monitoring  |
| **Terraform**       | terraform validate | terraform plan      | terraform apply (staging) | CloudWatch, DataDog   |
| **AWS**             | LocalStack         | AWS CLI testing     | AWS Config Rules          | CloudWatch, X-Ray     |
| **Azure**           | Azure CLI local    | Azure DevTest Labs  | Azure Policy              | Azure Monitor         |
| **GCP**             | gcloud local       | Cloud Build         | Cloud Security Scanner    | Cloud Monitoring      |

---

## Tool Selection Guidelines by Project Size

### **Startup/MVP (< 10 developers)**

- **Frontend**: Jest + Playwright + Sentry
- **Backend**: Language-native testing + basic APM
- **Mobile**: Platform defaults + Crashlytics
- **Database**: Docker + basic monitoring
- **DevOps**: Cloud provider defaults

### **Scale-up (10-50 developers)**

- **Frontend**: Add visual testing, advanced monitoring
- **Backend**: Add load testing, comprehensive APM
- **Mobile**: Add device labs, performance monitoring
- **Database**: Add performance testing, specialized monitoring
- **DevOps**: Add infrastructure testing, security scanning

### **Enterprise (50+ developers)**

- **Frontend**: Full cross-browser matrix, advanced analytics
- **Backend**: Comprehensive testing pyramid, enterprise APM
- **Mobile**: Full device coverage, enterprise mobile management
- **Database**: Full performance suite, enterprise monitoring
- **DevOps**: Full security compliance, enterprise monitoring
