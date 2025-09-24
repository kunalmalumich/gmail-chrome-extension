Component Locations & Visual Appearance
1. Sidebar Content Panel (Global.addSidebarContentPanel())
📍 Location: Right sidebar of Gmail (next to email content)
🎨 Visual:
Appears as a card/panel in the right sidebar
Has a header with title, icon, and close button
Contains your custom HTML content
Your Stamp AI chat interface uses this component
Code Example:
Apply to content.js
;
2. Thread-Specific Sidebar Panel (ThreadView.addSidebarContentPanel())
📍 Location: Right sidebar, but only visible when viewing a specific email thread
🎨 Visual: Same as global panel, but context-aware to the current email
3. Toolbar Buttons (Toolbars.registerThreadButton())
📍 Location: Gmail's main toolbar (above email list/thread view)
🎨 Visual:
Icon button in the toolbar
Can have dropdown menus
Appears alongside Gmail's native buttons (Reply, Forward, etc.)
Code Example:
Apply to content.js
;
4. Compose View Buttons (ComposeView.addButton())
�� Location: Inside compose window (draft email interface)
🎨 Visual:
Buttons in the compose toolbar
Can be in different sections: SEND_ACTION, TRAY_LEFT, etc.
Appears alongside Gmail's compose buttons
5. Modal Views (Widgets.showModalView())
�� Location: Overlay that appears on top of Gmail
🎨 Visual:
Modal dialog with backdrop
Can have custom styling (chrome: true/false)
Contains your custom HTML content
6. Drawer Views (Widgets.showDrawerView())
📍 Location: Sliding panel from the side of Gmail
🎨 Visual:
Sliding drawer that comes from the side
Can be associated with compose windows
Contains your custom HTML content
7. Mole Views (Widgets.showMoleView())
📍 Location: Floating panel that appears over Gmail content
�� Visual:
Floating window that can be positioned anywhere
Similar to a tooltip but larger and more interactive
8. Navigation Items (Global.addNavItem())
📍 Location: Left navigation sidebar of Gmail
🎨 Visual:
Menu items in Gmail's left navigation
Appears alongside "Inbox", "Sent", "Drafts", etc.
Can have icons and custom styling
9. Attachment Cards (MessageView.addAttachmentCardView())
�� Location: Inside email messages, with attachments
🎨 Visual:
Card that appears with email attachments
Can have preview images, download buttons, etc.
Integrates with Gmail's attachment display
10. Message Buttons (MessageView.addButton())
�� Location: Inside individual email messages
🎨 Visual:
Buttons that appear within email content
Can be positioned in different areas of the message
🔧 How Your Stamp AI Extension Works
Current Implementation:
Apply to content.js
;
Visual Result:
Right Sidebar Panel appears in Gmail
Header shows "Stamp" with your logo
Content Area contains your chat interface
Persistent - stays visible while browsing emails
🎯 Key Visual Design Patterns
1. Sidebar Panels (Your Current Choice)
✅ Persistent visibility - always accessible
✅ Large content area - perfect for chat interface
✅ Professional appearance - integrates well with Gmail
✅ Multiple panels - can have multiple extensions
2. Modal/Drawer Views
✅ Full-screen attention - good for complex workflows
❌ Temporary - disappear when closed
✅ Isolated - don't interfere with Gmail
3. Toolbar Buttons
✅ Always accessible - in main toolbar
❌ Limited space - small button area
✅ Context-aware - can respond to selected emails
4. Navigation Items
✅ Organized - fits with Gmail's navigation
❌ Limited space - small menu items
✅ Persistent - always in navigation
�� Advanced Component Combinations
Multi-Component Extension:
Apply to content.js
;
Context-Aware Extension:
Apply to content.js
;
💡 Design Recommendations for Your Extension
Current Approach (Sidebar Panel) - ✅ Excellent Choice
Perfect for chat interface - large, persistent area
Professional integration - looks native to Gmail
User-friendly - always accessible
Potential Enhancements:
Add toolbar button for quick actions
Add modal for complex workflows
Add message buttons for email-specific actions
Visual Hierarchy:
Primary Interface - Sidebar panel (chat)
Quick Actions - Toolbar buttons
Complex Workflows - Modal views
Context Actions - Message/thread-specific buttons
This understanding should help you design and implement your Chrome extension using InboxSDK's components effectively!


