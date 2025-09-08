/**
 * Tailwind UI Component Library
 * 
 * This library provides Tailwind-based components that can be used
 * alongside existing Bootstrap components during the migration process.
 * 
 * All components follow Scout theming and include:
 * - Scout color variants (scout-blue, scout-green, etc.)
 * - Responsive design
 * - Accessibility features
 * - TypeScript-friendly props
 * 
 * Quick Start:
 * 
 * import { Button, Card, Input, Modal, Alert } from './components/ui';
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
 *     <Input label="Name" placeholder="Enter your name" />
 *   </Card.Body>
 * </Card>
 */

// Core Components
export { default as Button } from './Button';
export { default as Card } from './Card';

// Form Components  
export { default as Input } from './Input';
export { default as Select } from './Select';
export { default as Checkbox } from './Checkbox';
export { default as FormGroup } from './FormGroup';

// Layout & Navigation
export { default as Header } from './Header';
export { default as Menu } from './Menu';
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
export { FormRow, FormSection, FormActions, Label, HelperText, ErrorText } from './FormGroup';
export { HeaderContainer, HeaderContent, HeaderLeft, HeaderCenter, HeaderRight, HeaderTitle, HeaderLogo } from './Header';
export { MenuButton, MenuItems, MenuItem, MenuDivider, Dropdown, Nav, NavItem } from './Menu';
export { ModalHeader, ModalTitle, ModalBody, ModalFooter } from './Modal';
export { AlertTitle, AlertDescription, AlertActions } from './Alert';
export { DotBadge, NumberBadge } from './Badge';