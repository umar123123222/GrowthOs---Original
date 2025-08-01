# Email Automation QA Checklist

## Pre-Test Setup
- [ ] Configure LMS SMTP in Company Settings → Email
- [ ] Configure Billing SMTP in Company Settings → Email  
- [ ] Verify both SMTP configs have different From addresses
- [ ] Ensure test email addresses are accessible

## Test Cases

### 1. Student Welcome Email (LMS SMTP)
- [ ] Create a new student via admin interface
- [ ] Verify email arrives from **LMS SMTP From address**
- [ ] Check email contains:
  - [ ] Student's first name
  - [ ] Email address
  - [ ] Temporary password
  - [ ] Login URL
  - [ ] Student ID
- [ ] Verify template placeholders are replaced correctly

### 2. Staff Welcome Email (LMS SMTP)  
- [ ] Create a new staff member (instructor/admin)
- [ ] Verify email arrives from **LMS SMTP From address**
- [ ] Check email contains:
  - [ ] Staff member's first name
  - [ ] Email address
  - [ ] Temporary password
  - [ ] Login URL
  - [ ] Role information
  - [ ] Department (if applicable)
- [ ] Verify template placeholders are replaced correctly

### 3. Student Invoice Email (Billing SMTP)
- [ ] Generate a new student invoice
- [ ] Verify email arrives from **Billing SMTP From address**
- [ ] Check email contains:
  - [ ] Student name
  - [ ] Invoice number in subject line
  - [ ] Invoice amount
  - [ ] Due date
  - [ ] Installment details
  - [ ] Payment instructions
  - [ ] Payment URL
  - [ ] Student ID
- [ ] Verify template placeholders are replaced correctly

## Error Handling Tests

### 4. Missing SMTP Configuration
- [ ] Disable LMS SMTP config
- [ ] Create student → verify retry scheduled in audit log
- [ ] Re-enable LMS SMTP config
- [ ] Verify email eventually sends after retry

### 5. SMTP Failure Simulation
- [ ] Configure invalid SMTP credentials
- [ ] Create student → verify exponential backoff retries
- [ ] Check audit log shows retry attempts with increasing delays

## Audit Log Verification
- [ ] Check admin_logs table contains entries for:
  - [ ] `mail.sent` events with success status
  - [ ] `mail.failed` events with error details
  - [ ] `mail.retry` events with delay information
- [ ] Verify audit entries include:
  - [ ] Purpose (lms/billing)
  - [ ] Template name
  - [ ] Recipient email
  - [ ] Attempt number
  - [ ] Status

## Cross-Verification
- [ ] Confirm student emails use LMS From address
- [ ] Confirm staff emails use LMS From address  
- [ ] Confirm invoice emails use Billing From address
- [ ] Verify no email mixing between purposes
- [ ] Test with multiple simultaneous triggers