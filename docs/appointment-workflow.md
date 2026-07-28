flowchart TD
    A[Patient Selects Doctor] --> B[Select Appointment Date]
    B --> C[Fetch Doctor Availability]
    C --> D[Generate Available Slots]

    D --> E{Slot Available?}

    E -- No --> F[Show Slot Unavailable Message]

    E -- Yes --> G[Validate Doctor Exists]
    G --> H[Validate Patient Profile & Role]
    H --> I[Validate Future Date]

    I --> J{Scheduling Type}

    J -- STREAM --> K[Validate Stream Slot]
    J -- WAVE --> L[Validate Wave Capacity & Assign Token]

    K --> M[Check Duplicate Booking]
    L --> M

    M --> N{Already Booked?}

    N -- Yes --> O[Return 409 Conflict]

    N -- No --> P[Create Appointment]
    P --> Q[Set Status = BOOKED]
    Q --> R[Save Appointment]
    R --> S[Return Success Response]

    S --> T[Patient Requests Cancellation]
    T --> U{Appointment Exists?}

    U -- No --> V[Return 404 Not Found]

    U -- Yes --> W[Update Status = CANCELLED]
    W --> X[Save Changes]
    X --> Y[Return Cancellation Success]