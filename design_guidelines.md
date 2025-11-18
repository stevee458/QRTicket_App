# QRTicket_App Design Guidelines

## Design Approach

**Selected Approach:** Design System - Material Design principles
**Justification:** This is a data-intensive registration application requiring clear form patterns, strong validation feedback, and trust-building professionalism. Material Design's structured approach to forms, input states, and feedback patterns aligns perfectly with parent-facing data collection.

## Core Design Elements

### Typography
- **Primary Font:** Inter or Roboto via Google Fonts CDN
- **Headings:** Font weight 600-700, sizes: text-2xl (form titles), text-xl (section headers), text-lg (subsections)
- **Body Text:** Font weight 400, text-base for labels, text-sm for helper text and validation messages
- **Input Text:** Font weight 400, text-base for optimal readability during data entry

### Layout System
**Spacing Primitives:** Tailwind units of 2, 4, 6, and 8
- Form containers: p-6 or p-8
- Input field spacing: mb-4 or mb-6 between fields
- Section gaps: space-y-6 or space-y-8
- Button spacing: px-6 py-3
- Card padding: p-6

**Container Strategy:**
- Max width for form: max-w-2xl (optimal for single-column forms)
- Multi-student cards: max-w-4xl to accommodate side-by-side layout when needed
- Centered layout with mx-auto

### Component Library

#### Form Components
**Input Fields:**
- Full-width inputs with clear labels positioned above fields
- Border styling with focus states (ring-2 ring-offset-1)
- Placeholder text for format guidance
- Helper text below fields for additional context
- Error states with inline validation messages below inputs
- Required field indicators (asterisk in label)

**Form Structure:**
- Parent Information Section: Single-column layout with all parent fields grouped
- Student Information Section: Dynamic repeatable cards
- Each student card contains all student fields in a contained unit
- Visual separation between students using borders or subtle backgrounds

**Add Student Functionality:**
- "Add Another Student" button below existing student cards
- Icon (plus symbol from chosen icon library) + label
- Outlined or secondary button style to differentiate from primary submit

**Submit Button:**
- Fixed bottom placement or natural flow after all fields
- Primary action styling, full-width on mobile, auto-width on desktop
- Clear label: "Complete Registration" or "Register Students"

#### Data Display Components
**Student Cards (for multi-student entry):**
- Each student entry in a distinct card with remove option
- Header showing "Student 1", "Student 2" etc.
- Two-column grid for fields on desktop (grid-cols-2 gap-4), single column on mobile
- Remove button (icon-only, subtle) in top-right corner of each card

**QR Code Display (Success State):**
- Grid layout for multiple QR codes: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Each QR code in a card showing:
  - Student name as header
  - QR code image (centered, appropriate size ~200x200px)
  - Student ID or identifier below
  - Download/Print button for individual QR code
- Overall "Download All" or "Print All" action at top

#### Feedback Components
**Success Confirmation:**
- Clear success message with icon (checkmark from icon library)
- Summary of registered students
- QR code display section
- Next steps or instructions

**Validation States:**
- Real-time validation on blur
- Red error text (text-sm) below invalid fields
- Success checkmarks for completed required fields
- Disabled submit button until form is valid

### Icons
**Library:** Heroicons (via CDN)
- Plus icon for "Add Student"
- Trash/X icon for "Remove Student"  
- CheckCircle for success states
- ExclamationCircle for error states
- Download icon for QR code actions
- QR code placeholder icon if needed

### Responsive Behavior
**Mobile (base):**
- Single column forms
- Full-width inputs and buttons
- Stack all form fields vertically
- Simplified student cards with essential info only

**Tablet (md:) and Desktop (lg:):**
- Two-column grids within student cards where logical (Name/Phone, Email/Age)
- Side margins increase (mx-auto with max-width containers)
- QR codes display in multi-column grid

### Accessibility
- All form inputs have associated labels with htmlFor attributes
- Sufficient color contrast for all text
- Focus indicators on all interactive elements
- Error messages programmatically associated with inputs
- Keyboard navigation support throughout form
- ARIA labels for icon-only buttons

### Page Structure
**Registration Form Page:**
1. Page header with app name/logo and clear title "Parent & Student Registration"
2. Brief instruction text explaining the process
3. Parent Information section (border or card container)
4. Student Information section with heading "Student Details"
5. Initial student entry card (Student 1)
6. "Add Another Student" button
7. Submit button
8. Optional: Progress indicator if multi-step

**Success Page:**
1. Success message header with icon
2. Registration summary
3. QR codes grid section with individual student cards
4. Action buttons (Download All, Return to Home, etc.)

### Form Validation Rules
- Parent Name, ID: Required, text validation
- Parent Phone: Required, phone format validation
- Parent Email: Required, email format validation
- Student Name: Required for each student
- Student Phone: Required, can default to parent phone
- Student Email: Required, can default to parent email
- Student Age: Required, numeric, reasonable range (5-25)
- Student School: Required, text/dropdown

### Animations
Minimal, purposeful animations only:
- Smooth transitions when adding/removing student cards (fade + slide)
- Button hover states (subtle scale or background change)
- QR code generation loading spinner if async
- Form submission loading state

No distracting or decorative animations.