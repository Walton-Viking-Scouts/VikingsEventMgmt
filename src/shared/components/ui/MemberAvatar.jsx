import React, { useEffect, useState } from 'react';
import { buildMemberPhotoUrl } from '../../utils/memberPhotos.js';

const SIZE_CLASSES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-24 w-24 text-2xl',
  xl: 'h-32 w-32 text-3xl',
};

const PHOTO_PIXEL_SIZE = {
  sm: '125x125',
  md: '125x125',
  lg: '250x250',
  xl: '250x250',
};

/**
 * Derive display initials for a member, preferring firstname/lastname but
 * falling back to a `name` field for transformed member objects that only
 * carry a combined name.
 *
 * @param {Object} [member] - Member data
 * @returns {string} Up to two initials, or an empty string if none available
 */
function getInitials(member) {
  if (!member) return '';

  if (member.firstname || member.lastname) {
    return `${member.firstname?.[0] || ''}${member.lastname?.[0] || ''}`;
  }

  if (member.name) {
    const [first, second] = String(member.name).trim().split(/\s+/);
    return `${first?.[0] || ''}${second?.[0] || ''}`;
  }

  return '';
}

/**
 * Derive a human-readable display name for alt text/aria-labels.
 *
 * @param {Object} [member] - Member data
 * @returns {string} The member's display name, or an empty string if none available
 */
function getDisplayName(member) {
  if (!member) return '';

  if (member.firstname || member.lastname) {
    return `${member.firstname || ''} ${member.lastname || ''}`.trim();
  }

  return member.name || '';
}

/**
 * Member Avatar Component
 *
 * Displays an OSM member's profile photo as a circular avatar, using the
 * public unauthenticated OSM member photo CDN (see buildMemberPhotoUrl in
 * shared/utils/memberPhotos.js). Falls back to a scout-purple circle with
 * the member's initials when no photo_guid is present, or if the photo
 * fails to load.
 *
 * Member object should contain: scoutid, photo_guid, and either
 * firstname/lastname or a combined name field.
 *
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.member - Member data (scoutid, photo_guid, firstname/lastname or name)
 * @param {'sm'|'md'|'lg'|'xl'} [props.size='sm'] - Avatar size: sm for table rows, md, lg for larger profile views, xl for photo-first galleries
 * @param {string} [props.className] - Additional classes merged onto the avatar element
 * @returns {JSX.Element} Circular photo or initials fallback
 *
 * @example
 * <MemberAvatar member={member} size="md" />
 */
function MemberAvatar({ member, size = 'sm', className = '' }) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [member?.scoutid, member?.photo_guid]);

  const sizeClasses = SIZE_CLASSES[size] || SIZE_CLASSES.sm;
  const photoUrl = imgError
    ? null
    : buildMemberPhotoUrl(member?.scoutid, member?.photo_guid, PHOTO_PIXEL_SIZE[size] || PHOTO_PIXEL_SIZE.sm);
  const displayName = getDisplayName(member);

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={displayName ? `Photo of ${displayName}` : 'Member photo'}
        loading="lazy"
        onError={() => setImgError(true)}
        className={`rounded-full object-cover ${sizeClasses} ${className}`}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={displayName ? `${displayName} (no photo available)` : 'Member (no photo available)'}
      className={`rounded-full bg-scout-purple text-white flex items-center justify-center font-semibold ${sizeClasses} ${className}`}
    >
      {getInitials(member)}
    </div>
  );
}

export default MemberAvatar;
