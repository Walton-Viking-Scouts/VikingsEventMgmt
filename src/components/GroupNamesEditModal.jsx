import React, { useState, useEffect, useCallback } from "react";
import { Button, Input, Alert } from "./ui";
import logger, { LOG_CATEGORIES } from "../services/logger.js";

/**
 * Modal for editing camp group names
 * Allows bulk renaming of groups with validation and multi-section support
 *
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Close modal callback
 * @param {Object} props.groups - Current groups object from organizedGroups.groups
 * @param {Function} props.onRename - Rename callback with (oldName, newName, membersBySection)
 * @param {Function} props.onDelete - Delete callback with (groupName, membersBySection)
 * @param {boolean} props.loading - Whether rename operation is in progress
 */
function GroupNamesEditModal({
  isOpen,
  onClose,
  groups = {},
  onRename,
  onDelete,
  loading = false,
}) {
  const [groupNames, setGroupNames] = useState({});
  const [errors, setErrors] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize group names when modal opens or groups change
  useEffect(() => {
    if (isOpen && groups) {
      const initialNames = {};
      Object.entries(groups).forEach(([groupName]) => {
        // Use group name without "Group " prefix for editing
        const displayName = groupName.replace(/^Group /, "");
        initialNames[groupName] = displayName;
      });
      setGroupNames(initialNames);
      setErrors({});
      setHasChanges(false);
    }
  }, [isOpen, groups]);

  // Validate group names for uniqueness and constraints
  const validateNames = useCallback((names) => {
    const newErrors = {};
    const usedNames = new Set();

    Object.entries(names).forEach(([originalGroupName, newName]) => {
      const trimmedName = newName.trim();
      const lowerName = trimmedName.toLowerCase();

      // Required field
      if (!trimmedName) {
        newErrors[originalGroupName] = "Group name is required";
        return;
      }

      // Check for duplicates
      if (usedNames.has(lowerName)) {
        newErrors[originalGroupName] = "Group name must be unique";
        return;
      }

      // Check for reserved names - only block "Unassigned" for non-unassigned groups
      if (
        lowerName === "unassigned" &&
        originalGroupName !== "Group Unassigned"
      ) {
        newErrors[originalGroupName] = '"Unassigned" is a reserved name';
        return;
      }

      // Character validation (basic)
      if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmedName)) {
        newErrors[originalGroupName] =
          "Only letters, numbers, spaces, hyphens and underscores allowed";
        return;
      }

      // Length validation
      if (trimmedName.length > 20) {
        newErrors[originalGroupName] =
          "Group name too long (max 20 characters)";
        return;
      }

      usedNames.add(lowerName);
    });

    return newErrors;
  }, []);

  // Handle name change
  const handleNameChange = useCallback(
    (originalGroupName, newValue) => {
      setGroupNames((prev) => {
        const updated = { ...prev, [originalGroupName]: newValue };

        // Check if there are changes from original
        const hasActualChanges = Object.entries(updated).some(
          ([groupName, newName]) => {
            const originalDisplayName = groupName.replace(/^Group /, "");
            return newName.trim() !== originalDisplayName;
          },
        );

        setHasChanges(hasActualChanges);

        // Validate on each change
        const validationErrors = validateNames(updated);
        setErrors(validationErrors);

        return updated;
      });
    },
    [validateNames],
  );

  // Handle save
  const handleSave = useCallback(async () => {
    if (loading) return;

    const validationErrors = validateNames(groupNames);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Process renames
    const renames = [];
    Object.entries(groupNames).forEach(([originalGroupName, newName]) => {
      const trimmedNewName = newName.trim();
      const originalDisplayName = originalGroupName.replace(/^Group /, "");

      if (trimmedNewName !== originalDisplayName) {
        const group = groups[originalGroupName];
        if (group) {
          // Organize members by section for multi-section API calls
          const membersBySection = {};

          [...(group.youngPeople || []), ...(group.leaders || [])].forEach(
            (member) => {
              const sectionId = member.sectionid;
              if (!membersBySection[sectionId]) {
                membersBySection[sectionId] = [];
              }
              membersBySection[sectionId].push(member);
            },
          );

          renames.push({
            oldName: originalGroupName,
            newName: trimmedNewName,
            membersBySection,
            group,
          });
        }
      }
    });

    if (renames.length === 0) {
      logger.info("No group names to rename", {}, LOG_CATEGORIES.APP);
      onClose();
      return;
    }

    logger.info(
      "Processing group renames",
      {
        renameCount: renames.length,
        totalGroups: Object.keys(groups).length,
      },
      LOG_CATEGORIES.APP,
    );

    // Execute renames through callback
    for (const rename of renames) {
      try {
        await onRename(rename.oldName, rename.newName, rename.membersBySection);
      } catch (error) {
        logger.error(
          "Failed to rename group",
          {
            oldName: rename.oldName,
            newName: rename.newName,
            error: error.message,
          },
          LOG_CATEGORIES.ERROR,
        );

        // Continue with other renames even if one fails
        continue;
      }
    }

    // Close modal after all renames are processed
    onClose();
  }, [groupNames, groups, onRename, onClose, loading, validateNames]);

  // Handle delete group
  const handleDeleteGroup = useCallback(
    async (groupName) => {
      if (loading || !onDelete) return;

      const group = groups[groupName];
      if (!group) return;

      // Organize members by section for multi-section API calls
      const membersBySection = {};

      [...(group.youngPeople || []), ...(group.leaders || [])].forEach(
        (member) => {
          const sectionId = member.sectionid;
          if (!membersBySection[sectionId]) {
            membersBySection[sectionId] = [];
          }
          membersBySection[sectionId].push(member);
        },
      );

      const memberCount = Object.values(membersBySection).reduce(
        (sum, members) => sum + members.length,
        0,
      );

      // Debug: Log exactly which members are being deleted
      logger.info(
        "Group delete preparation",
        {
          groupName,
          memberCount,
          membersToDelete: Object.fromEntries(
            Object.entries(membersBySection).map(([sectionId, members]) => [
              sectionId,
              members.map((m) => ({
                scoutid: m.scoutid,
                name: m.name || `${m.firstname} ${m.lastname}`,
              })),
            ]),
          ),
        },
        LOG_CATEGORIES.APP,
      );

      if (memberCount === 0) {
        logger.info(
          "No members to delete for empty group",
          { groupName },
          LOG_CATEGORIES.APP,
        );
        return;
      }

      // Confirm deletion
      const confirmed = window.confirm(
        `Delete "${groupName}" and move ${memberCount} member${memberCount !== 1 ? "s" : ""} to Unassigned?`,
      );

      if (!confirmed) return;

      try {
        await onDelete(groupName, membersBySection);
        onClose();
      } catch (error) {
        logger.error(
          "Failed to delete group",
          {
            groupName,
            error: error.message,
          },
          LOG_CATEGORIES.ERROR,
        );
      }
    },
    [groups, onDelete, loading, onClose],
  );

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (loading) return;
    onClose();
  }, [onClose, loading]);

  if (!isOpen) return null;

  const groupEntries = Object.entries(groups).sort((a, b) => {
    // Sort: numbered groups first, then unassigned last
    const [nameA] = a;
    const [nameB] = b;

    if (nameA === "Group Unassigned") return 1;
    if (nameB === "Group Unassigned") return -1;

    const numA = parseInt(nameA.replace("Group ", "")) || 0;
    const numB = parseInt(nameB.replace("Group ", "")) || 0;
    return numA - numB;
  });

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      data-oid="0r8sfba"
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        data-oid="yz94zzq"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200" data-oid="vkou_0_">
          <h2
            className="text-xl font-semibold text-gray-900"
            data-oid="-gf0e8e"
          >
            Edit Group Names
          </h2>
          <p className="text-sm text-gray-600 mt-1" data-oid="hp08og-">
            Rename camp groups - all members in each group will be updated
          </p>
        </div>

        {/* Content */}
        <div
          className="px-6 py-4 overflow-y-auto max-h-[60vh]"
          data-oid="__1i4y2"
        >
          {Object.keys(errors).length > 0 && (
            <Alert variant="danger" className="mb-4" data-oid="mgkz6kh">
              <Alert.Title data-oid="tqjz087">Validation Errors</Alert.Title>
              <Alert.Description data-oid="54jh__d">
                Please fix the errors below before saving.
              </Alert.Description>
            </Alert>
          )}

          <div className="space-y-4" data-oid="-kuogea">
            {groupEntries.map(([originalGroupName, group]) => {
              const memberCount =
                (group.youngPeople?.length || 0) + (group.leaders?.length || 0);
              const currentValue = groupNames[originalGroupName] || "";
              const hasError = errors[originalGroupName];

              return (
                <div
                  key={originalGroupName}
                  className="flex items-center space-x-4 p-4 border rounded-lg"
                  data-oid="86s:fre"
                >
                  <div
                    className="flex-shrink-0 w-20 text-sm text-gray-600"
                    data-oid=":kx2ms-"
                  >
                    {memberCount} member{memberCount !== 1 ? "s" : ""}
                  </div>

                  <div className="flex-1" data-oid="v3hqu.u">
                    <Input
                      id={`group-${originalGroupName}`}
                      value={currentValue}
                      onChange={(e) =>
                        handleNameChange(originalGroupName, e.target.value)
                      }
                      placeholder="Enter new group name"
                      className={
                        hasError ? "border-red-500 focus:border-red-500" : ""
                      }
                      disabled={loading}
                      data-oid="nnnk4nz"
                    />

                    {hasError && (
                      <p
                        className="text-red-500 text-xs mt-1"
                        data-oid="43pbk8."
                      >
                        {hasError}
                      </p>
                    )}
                  </div>

                  {/* Delete button - don't show for Unassigned group */}
                  {originalGroupName !== "Group Unassigned" &&
                    memberCount > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteGroup(originalGroupName)}
                        disabled={loading}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        type="button"
                        title={`Delete ${originalGroupName} (move ${memberCount} member${memberCount !== 1 ? "s" : ""} to Unassigned)`}
                        data-oid="udyf:.v"
                      >
                        Delete
                      </Button>
                    )}
                </div>
              );
            })}
          </div>

          {groupEntries.length === 0 && (
            <div className="text-center py-8 text-gray-500" data-oid="rj3tm-3">
              No groups available to rename
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3"
          data-oid="1vc:nbo"
        >
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
            type="button"
            data-oid="-nvt1-t"
          >
            Cancel
          </Button>
          <Button
            variant="scout-blue"
            onClick={handleSave}
            disabled={loading || Object.keys(errors).length > 0 || !hasChanges}
            type="button"
            data-oid="2dke2.i"
          >
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default GroupNamesEditModal;
