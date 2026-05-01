import { google } from 'googleapis';
import * as path from 'path';

/**
 * Initializes and returns instances of 20+ Google Cloud Platform (GCP) and Google APIs
 * using the provided service-account-key.json file.
 * 
 * Note: This code is meant to run in a Node.js backend environment. Exposing service account keys
 * in frontend code (like a Vite React app) is a major security risk.
 */
export async function initializeGCPServices() {
  // Define the path to the service account key file
  const keyFilePath = path.join(process.cwd(), 'service-account-key.json');

  // Create an authentication client using the key file
  const auth = new google.auth.GoogleAuth({
    keyFile: keyFilePath,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  const authClient = await auth.getClient();

  // Initialize 20+ Google Services
  return {
    // 1. Google Drive API (File Storage)
    drive: google.drive({ version: 'v3', auth: authClient }),
    
    // 2. Google Sheets API (Spreadsheets)
    sheets: google.sheets({ version: 'v4', auth: authClient }),
    
    // 3. Google Docs API (Documents)
    docs: google.docs({ version: 'v1', auth: authClient }),
    
    // 4. Google Calendar API (Events and Scheduling)
    calendar: google.calendar({ version: 'v3', auth: authClient }),
    
    // 5. Cloud Storage API (Object Storage)
    storage: google.storage({ version: 'v1', auth: authClient }),
    
    // 6. BigQuery API (Data Warehouse)
    bigquery: google.bigquery({ version: 'v2', auth: authClient }),
    
    // 7. Cloud Pub/Sub API (Messaging)
    pubsub: google.pubsub({ version: 'v1', auth: authClient }),
    
    // 8. Cloud Vision API (Image Analysis)
    vision: google.vision({ version: 'v1', auth: authClient }),
    
    // 9. Cloud Natural Language API (Text Analysis)
    language: google.language({ version: 'v1', auth: authClient }),
    
    // 10. Cloud Translation API (Language Translation)
    translate: google.translate({ version: 'v2', auth: authClient }),
    
    // 11. Cloud Spanner API (Relational Database)
    spanner: google.spanner({ version: 'v1', auth: authClient }),
    
    // 12. Firestore / Datastore API (NoSQL Database)
    firestore: google.firestore({ version: 'v1', auth: authClient }),
    
    // 13. Compute Engine API (Virtual Machines)
    compute: google.compute({ version: 'v1', auth: authClient }),
    
    // 14. Identity and Access Management (IAM) API
    iam: google.iam({ version: 'v1', auth: authClient }),
    
    // 15. Cloud Logging API (Logs Management)
    logging: google.logging({ version: 'v2', auth: authClient }),
    
    // 16. Cloud Monitoring API (Metrics & Alerts)
    monitoring: google.monitoring({ version: 'v3', auth: authClient }),
    
    // 17. Secret Manager API (Secrets Management)
    secretmanager: google.secretmanager({ version: 'v1', auth: authClient }),
    
    // 18. Cloud Build API (CI/CD)
    cloudbuild: google.cloudbuild({ version: 'v1', auth: authClient }),
    
    // 19. Cloud Functions API (Serverless Functions)
    cloudfunctions: google.cloudfunctions({ version: 'v1', auth: authClient }),
    
    // 20. Cloud Run API (Containerized Apps)
    cloudrun: google.run({ version: 'v1', auth: authClient }),
    
    // 21. Cloud KMS API (Key Management Service)
    kms: google.cloudkms({ version: 'v1', auth: authClient }),
    
    // 22. Cloud Scheduler API (Cron Jobs)
    scheduler: google.cloudscheduler({ version: 'v1', auth: authClient }),
    
    // 23. Google Forms API
    forms: google.forms({ version: 'v1', auth: authClient }),
  };
}
