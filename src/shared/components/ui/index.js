/**
 * Tailwind UI Component Library
 * 
 * This library provides essential Tailwind-based components for the application.
 * 
 * All components follow Scout theming and include:
 * - Scout color variants (scout-blue, scout-green, etc.)
 * - Responsive design
 * - Accessibility features
 * - TypeScript-friendly props
 * 
 * Quick Start:
 * 
 * import { Card, Modal, Alert } from './components/ui';
 * 
 * <Card>
 *   <Card.Header>
 *     <Card.Title>Title</Card.Title>
 *   </Card.Header>
 *   <Card.Body>
 *     Content here
 *   </Card.Body>
 * </Card>
 */

// Core Components
// Card component removed - migrated to direct Tailwind implementation

// Layout & Navigation
export { default as Modal } from './Modal';
export { default as ConfirmModal } from './ConfirmModal';

// Feedback & Status
export { default as Alert } from './Alert';
// Badge component removed - migrated to direct Tailwind implementation

// Feature Components - moved from features to shared
export { default as SectionFilter } from './SectionFilter';
export { default as SectionCardsFlexMasonry } from './SectionCardsFlexMasonry';
export { default as MemberDetailModal } from './MemberDetailModal';
export { default as MedicalDataDisplay } from './MedicalDataDisplay';
export { MedicalDataPill, MedicalDataList } from './MedicalDataDisplay';

// Re-export individual components for convenience
// Card components removed - migrated to direct Tailwind implementation
export { ModalHeader, ModalTitle, ModalBody, ModalFooter } from './Modal';
export { AlertTitle, AlertDescription, AlertActions } from './Alert';
// Badge components removed - migrated to direct Tailwind implementation