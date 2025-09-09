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
 * import { Button, Card, Modal, Alert } from './components/ui';
 * 
 * <Button variant="scout-blue" size="lg">
 *   Scout Blue Button
 * </Button>
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
export { default as Button } from './Button';
export { default as Card } from './Card';

// Layout & Navigation
export { default as Modal } from './Modal';
export { default as ConfirmModal } from './ConfirmModal';

// Feedback & Status
export { default as Alert } from './Alert';
export { default as Badge } from './Badge';

// Feature Components - moved from features to shared
export { default as SectionFilter } from './SectionFilter';
export { default as SectionCardsFlexMasonry } from './SectionCardsFlexMasonry';
export { default as MemberDetailModal } from './MemberDetailModal';
export { default as MedicalDataDisplay } from './MedicalDataDisplay';
export { MedicalDataPill, MedicalDataList } from './MedicalDataDisplay';

// Re-export individual components for convenience
export { CardHeader, CardTitle, CardBody, CardFooter } from './Card';
export { ModalHeader, ModalTitle, ModalBody, ModalFooter } from './Modal';
export { AlertTitle, AlertDescription, AlertActions } from './Alert';
export { DotBadge, NumberBadge } from './Badge';