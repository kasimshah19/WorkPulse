# WorkPulse – Roles, Dashboards & ER Diagrams

---

## 1. Project Roles (भूमिकाएं)

WorkPulse प्लेटफ़ॉर्म पर मुख्य रूप से **3 प्राथमिक भूमिकाएं (Roles)** हैं:

| Role (भूमिका) | विवरण (Description) | प्राथमिक लक्ष्य (Primary Goal) |
|---|---|---|
| **1. Worker (मजदूर / कारीगर)** | दिहाड़ी मजदूर, मिस्त्री, बढ़ई, इलेक्ट्रीशियन, प्लंबर आदि | पास में काम ढूंढना, हाजिरी लगाना और काम खत्म होते ही गारंटीड UPI भुगतान पाना। |
| **2. Contractor (ठेकेदार / मालिक)** | छोटे बिल्डर, पेटी ठेकेदार, साइट सुपरवाइजर | सत्यापित मजदूर पाना, साइट पर उपस्थिति की पुष्टि करना और सुरक्षित एस्क्रो फंड करना। |
| **3. Admin / Arbitrator (व्यवस्थापक / मध्यस्थ)** | WorkPulse ऑपरेशंस टीम, कानूनी/विवाद समाधान अधिकारी | विवादों की जांच (GPS + सेल्फी साक्ष्य), प्लेटफॉर्म सुरक्षा, और फर्जीवाड़े की रोकथाम। |

---

## 2. Complete ER Diagram (डेटाबेस संबंध चित्र)

```mermaid
erDiagram
    USERS ||--o{ JOBS : "creates (Contractor)"
    USERS ||--o{ ATTENDANCES : "checks-in (Worker)"
    USERS ||--o{ ESCROW_TRANSACTIONS : "funds (Contractor)"
    USERS ||--o{ ESCROW_TRANSACTIONS : "receives (Worker)"
    USERS ||--o{ RATINGS : "gives/receives"
    USERS ||--o{ INCIDENTS : "reports"

    JOBS ||--o{ ATTENDANCES : "contains"
    JOBS ||--o{ ESCROW_TRANSACTIONS : "has"
    JOBS ||--o{ RATINGS : "rated-for"
    JOBS ||--o{ INCIDENTS : "associated-with"

    ESCROW_TRANSACTIONS ||--o{ LEDGER_ENTRIES : "generates-audit-trail"

    USERS {
        ObjectId _id PK
        string name "User Full Name"
        string phone UK "Unique 10-digit mobile"
        string role "worker | contractor | admin"
        string[] skills "plumber, mason, etc."
        Point location "GeoJSON [lon, lat] 2dsphere"
        string languagePreference "hi, en, mr"
        string upiId "worker@upi"
        boolean isVerified "KYC / Phone OTP verified"
        datetime createdAt
    }

    JOBS {
        ObjectId _id PK
        ObjectId contractor FK "Ref to USERS"
        string title "Mason needed for 3 days"
        string skillRequired "mason"
        number workersNeeded "Count of workers"
        number wagePerDay "Daily wage (INR)"
        date startDate
        date endDate
        Point location "GeoJSON [lon, lat] 2dsphere"
        number radiusMeters "Geofence boundary (e.g. 500m)"
        string status "draft | open | in_progress | completed | cancelled"
        ObjectId[] assignedWorkers FK "Refs to USERS"
        datetime createdAt
    }

    ATTENDANCES {
        ObjectId _id PK
        ObjectId job FK "Ref to JOBS"
        ObjectId worker FK "Ref to USERS"
        datetime checkInAt "Time of check-in"
        datetime checkOutAt "Time of check-out"
        Point checkInLocation "GPS coords at check-in"
        Point checkOutLocation "GPS coords at check-out"
        string selfieUrl "Proof-of-work photo URL"
        number distanceFromSite "Distance from job point (meters)"
        datetime createdAt
    }

    ESCROW_TRANSACTIONS {
        ObjectId _id PK
        ObjectId job FK "Ref to JOBS"
        ObjectId contractor FK "Ref to USERS"
        ObjectId worker FK "Ref to USERS"
        number amount "INR locked in escrow"
        string status "CREATED|FUNDED|CHECKED_IN|CHECKED_OUT|APPROVED|RELEASED|DISPUTED|CANCELLED"
        string idempotencyKey UK "UUID for duplicate prevention"
        datetime createdAt
        datetime updatedAt
    }

    LEDGER_ENTRIES {
        ObjectId _id PK
        ObjectId transaction FK "Ref to ESCROW_TRANSACTIONS"
        string type "DEBIT | CREDIT"
        string account "CONTRACTOR_HOLDING | WORKER_PAYOUT | PLATFORM_FEE"
        number amount "INR"
        number balanceAfter "Account balance"
        datetime createdAt "Immutable timestamp"
    }

    RATINGS {
        ObjectId _id PK
        ObjectId job FK "Ref to JOBS"
        ObjectId fromUser FK "Ref to USERS"
        ObjectId toUser FK "Ref to USERS"
        number score "1 to 5"
        string type "worker_skill | contractor_payment_safety"
        string comment
        datetime createdAt
    }

    INCIDENTS {
        ObjectId _id PK
        ObjectId job FK "Ref to JOBS"
        ObjectId reportedBy FK "Ref to USERS"
        Point location "GPS coords"
        string severity "low | medium | high | critical"
        string type "SOS | injury | dispute"
        string status "open | investigating | resolved | closed"
        string notes
        datetime createdAt
    }
```

---

## 3. Dashboards Architecture (डैशबोर्ड संरचना)

WorkPulse में कुल **3 अलग-अलग Dashboards** हैं:

```mermaid
flowchart TD
    Landing[WorkPulse Home / Landing Page] -->|Phone OTP Login| Auth{Role Selector / JWT}
    
    Auth -->|role == 'worker'| WD[1. Worker Dashboard]
    Auth -->|role == 'contractor'| CD[2. Contractor Dashboard]
    Auth -->|role == 'admin'| AD[3. Admin & Arbitration Dashboard]

    subgraph WD_Views [Worker Dashboard Views]
        WD --> W1[पास के काम / Nearby Jobs]
        WD --> W2[हाजिरी और सेल्फी / Attendance Check-In]
        WD --> W3[बटुआ और UPI भुगतान / Wallet & Payouts]
        WD --> W4[SOS इमरजेंसी बटन / Emergency SOS]
    end

    subgraph CD_Views [Contractor Dashboard Views]
        CD --> C1[नया काम पोस्ट करें / Post New Job]
        CD --> C2[लाइव साइट हाजिरी / Live Attendance Monitor]
        CD --> C3[एस्क्रो फंड व रिलीज / Escrow Funding & Approval]
        CD --> C4[कारीगर रेटिंग / Worker Ratings]
    end

    subgraph AD_Views [Admin Dashboard Views]
        AD --> A1[विवाद समाधान / Dispute Resolution Panel]
        AD --> A2[एस्क्रो लेजर और ऑडिट / Escrow Financial Ledger]
        AD --> A3[धोखाधड़ी पहचान / Anti-Spoofing & Fraud Detection]
        AD --> A4[सिस्टम स्वास्थ्य / Real-time System Metrics]
    end
```

---

## 4. Dashboard 1: Worker Dashboard (`/worker/dashboard`)

```mermaid
flowchart TB
    subgraph UI_Worker [Worker Mobile Interface]
        W_Header[शीर्ष पट्टी: भाषा चयन & प्रोफाइल]
        W_Status[आज की स्थिति: क्या आज कोई काम असाइन है?]
        W_Action1[बड़ा बटन: आज की हाजिरी लगाएं - GPS + सेल्फी]
        W_Action2[बड़ा बटन: पास में काम खोजें - Geo Radius Search]
        W_Action3[बड़ा बटन: मेरा बटुआ - आज की कमाई और UPI निकासी]
        W_SOS[लाल रंग का SOS बटन - तुरंत सुरक्षा अलर्ट]
    end

    W_Action1 -->|GPS Boundary Check| AttCheck{साइट के 500m दायरे में है?}
    AttCheck -->|हाँ| Camera[कैमरा खुला -> सेल्फी ली -> CheckIn दर्ज]
    AttCheck -->|नहीं| Warning[चेतावनी: साइट से दूर हैं]

    W_Action2 --> NearbyAPI[GET /jobs?lat=..&lon=..&radius=5000]
    W_Action3 --> WalletAPI[GET /escrow/status + UPI Instant Payout]
```

### मुख्य फीचर्स:
1. **एक-क्लिक GPS हाजिरी**: जब मजदूर साइट पर पहुंचता है, तो GPS दूरी चेक होती है और सेल्फी प्रूफ अपलोड होता है।
2. **आवाज आधारित सर्च (Phase 5)**: बिना टाइप किए बोलकर काम खोजना।
3. **तुरंत UPI ट्रांसफर**: ठेकेदार द्वारा काम स्वीकृत करते ही सीधे मजदूर के UPI खाते में पैसा पहुंचना।
4. **इमरजेंसी SOS**: किसी भी दुर्घटना या विवाद की स्थिति में तुरंत लोकेशन ब्रॉडकास्ट।

---

## 5. Dashboard 2: Contractor Dashboard (`/contractor/dashboard`)

```mermaid
flowchart TB
    subgraph UI_Contractor [Contractor Dashboard Interface]
        C_Header[साइट स्थिति और सक्रिय मजदूर काउंटर]
        C_Action1[नया काम पोस्ट करें: स्थान, दिहाड़ी, कौशल, मजदूरों की संख्या]
        C_Action2[एस्क्रो फंड जमा करें: Razorpay पेमेंट गेटवे]
        C_Action3[लाइव हाजिरी मॉनिटर: मजदूरों की सेल्फी और GPS लोकेशन]
        C_Action4[दिन की समाप्ति पर काम स्वीकृति: 1-Click Escrow Release]
    end

    C_Action1 --> JobPost[POST /jobs]
    JobPost --> EscrowInit[Escrow State: CREATED]
    C_Action2 --> EscrowFund[Escrow State: FUNDED]
    C_Action3 --> LiveCheckIn[Socket.io live checkin feed]
    C_Action4 --> EscrowRelease[Escrow State: APPROVED -> RELEASED]
```

### मुख्य फीचर्स:
1. **काम पोस्टिंग विज़ार्ड**: नक्शे पर पिन लगाकर साइट का घेरा (500m/1km) और दैनिक मजदूरी तय करना।
2. **एस्क्रो लॉकिंग**: ठेकेदार का पैसा पहले ही सुरक्षित एस्क्रो में जमा हो जाता है, जिससे मजदूर को भुगतान की 100% गारंटी मिलती है।
3. **लाइव उपस्थिति स्क्रीन**: ठेकेदार देख सकता है कि कौन-सा मजदूर किस समय साइट पर आया और उसकी सेल्फी क्या है।
4. **अप्रूवल या विवाद**: काम पूरा होने पर तुरंत पैसा रिलीज करें या समस्या होने पर विवाद उठाएं।

---

## 6. Dashboard 3: Admin & Dispute Dashboard (`/admin/dashboard`)

```mermaid
flowchart TB
    subgraph UI_Admin [Admin & Arbitration Interface]
        A_Disputes[सक्रिय विवाद सूची / Pending Disputes]
        A_Ledger[वित्तीय लेज़र / Double-Entry Ledger View]
        A_Fraud[संदिग्ध गतिविधि / GPS Spoofing Alerts]
    end

    A_Disputes --> EvidenceView[साक्ष्य विश्लेषण]
    subgraph EvidenceView [मध्यस्थता साक्ष्य]
        E1[मजदूर का GPS चेक-इन/आउट समय]
        E2[साइट पर ली गई जियो-टैग्ड सेल्फी]
        E3[ठेकेदार की शिकायत व फोटो]
    end

    EvidenceView --> Decision{एडमिन फैसला}
    Decision -->|मजदूर सही| ForceRelease[पैसा मजदूर को रिलीज करें]
    Decision -->|ठेकेदार सही| ForceRefund[पैसा ठेकेदार को वापस करें]
    Decision -->|आपसी समझौता| SplitPayout[आंशिक भुगतान]
```

### मुख्य फीचर्स:
1. **पारदर्शी साक्ष्य केंद्र (Evidence Center)**: दोनों पक्षों की लोकेशन टाइमस्टैम्प, सेल्फी और काम के फोटो की तुलना।
2. **ऑडिट लेज़र (Immutable Ledger)**: पाई-पाई का हिसाब रखने वाला अपरिवर्तनीय लेज़र।
3. **धोखाधड़ी चेतावनी (Anti-Fraud)**: नकली GPS (Mock location) या बार-बार विवाद करने वाले खातों को फ्लैग/ब्लॉक करना।
