# Student Creation System

## Overview
The student creation system handles the complete onboarding process including LMS account creation, invoice generation, and email notifications.

## Flow

### 1. Form Submission
- User fills out the "Add New Student" form with:
  - Full Name (required, min 3 chars)
  - Email (required, valid email format)
  - Phone (required, with country code)
  - Fees Structure (required, dropdown selection)

### 2. Backend Processing (`create-student-complete` Edge Function)
1. **Validation**: Validates all required fields
2. **Auth User Creation**: Creates Supabase auth user with generated password
3. **Student ID Generation**: Auto-generates sequential ID (STU000001, STU000002, etc.)
4. **Database Record**: Inserts student record with:
   - `student_id`: Auto-generated (STU000001 format)
   - `lms_user_id`: Student's email
   - `lms_status`: 'inactive' (until first payment)
   - `created_by`: Current superadmin's UID
   - `fees_overdue`: true (until payment)
5. **Invoice Creation**: Creates initial invoice with 14-day due date
6. **Email Notifications**: Sends two emails if Resend is configured:
   - LMS credentials email with login details
   - Invoice email with payment instructions

### 3. UI Response
- **Success**: Shows success toast, closes modal, refreshes student list
- **Error**: Shows specific error message from backend
- **Email Status**: Indicates if emails were sent successfully

## Key Features

### Auto-Generated Student IDs
Students get sequential IDs starting from STU000001. The system counts existing students and increments.

### Comprehensive Email System
Two separate emails are sent:
1. **LMS Access Email**: Contains login credentials and welcome message
2. **Invoice Email**: Contains payment details and due date

### Proper Error Handling
- Detailed console logging for debugging
- Graceful degradation if email fails
- Specific error messages returned to UI
- Non-blocking invoice creation

### Default Settings
- LMS status starts as 'inactive'
- Fees are marked as overdue until payment
- Onboarding marked as not completed
- Secure random password generation

## Testing Criteria

✅ Form validation works for all fields  
✅ Student creation completes without errors  
✅ Auto-generated student ID follows STU000001 format  
✅ LMS user created with correct email and password  
✅ Invoice record created with correct amount  
✅ Two emails sent (LMS + Invoice)  
✅ Success toast shows with email confirmation  
✅ Duplicate email handling (graceful error)  
✅ Form resets after successful creation  

## Configuration Requirements

### Environment Variables (Edge Function)
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for admin operations
- `RESEND_API_KEY`: For email sending (optional but recommended)

### Database Tables
- `users`: Main user records with student data
- `invoices`: Invoice tracking (optional, will skip if table doesn't exist)

## Error Scenarios & Handling

1. **Missing Environment Variables**: Returns 500 with configuration error
2. **Duplicate Email**: Returns 400 with "user already exists" message
3. **Email Service Down**: Student still created, email marked as failed
4. **Invoice Creation Fails**: Student still created, invoice skipped
5. **Database Constraint Violations**: Full rollback with specific error message