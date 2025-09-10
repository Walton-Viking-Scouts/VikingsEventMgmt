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
 * import { Modal, Alert } from './components/ui';
 * 
 * <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
 *   <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
 *     <h2 className="text-lg font-semibold text-gray-900 m-0">Title</h2>
 *   </div>
 *   <div className="p-4">
 *     Content here
 *   </div>
 * </div>
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