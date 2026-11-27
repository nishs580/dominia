const A = require('../avatar');

describe('avatarThumb / avatarInitials', () => {
  test('thumb requests 2x the render size and keeps existing query params', () => {
    expect(A.avatarThumb('https://img.clerk.com/a', 48)).toBe('https://img.clerk.com/a?width=96');
    expect(A.avatarThumb('https://img.clerk.com/a?x=1', 48)).toBe('https://img.clerk.com/a?x=1&width=96');
    expect(A.avatarThumb(null, 48)).toBeNull();
    expect(A.avatarThumb('', 48)).toBeNull();
  });

  test('initials are two uppercase letters, ?? when empty', () => {
    expect(A.avatarInitials('moksh')).toBe('MO');
    expect(A.avatarInitials('  ')).toBe('??');
    expect(A.avatarInitials(null)).toBe('??');
  });
});

describe('avatarSource', () => {
  test('prefers avatar_url', () => {
    expect(A.avatarSource({ avatar_url: 'https://img.clerk.com/a', username: 'moksh' }, 64)).toEqual({
      kind: 'photo',
      uri: 'https://img.clerk.com/a?width=128',
    });
  });

  test('falls back to initials without avatar_url', () => {
    expect(A.avatarSource({ avatar_url: null, username: 'moksh' }, 64)).toEqual({ kind: 'initials', initials: 'MO' });
    expect(A.avatarSource(null, 64)).toEqual({ kind: 'initials', initials: '??' });
  });
});

describe('clerk sync', () => {
  test('Clerk default images do not count as a photo', () => {
    expect(A.clerkAvatarUrl({ hasImage: false, imageUrl: 'https://img.clerk.com/default' })).toBeNull();
    expect(A.clerkAvatarUrl({ hasImage: true, imageUrl: 'https://img.clerk.com/u' })).toBe('https://img.clerk.com/u');
  });

  test('avatarSyncValue patches only when the cache disagrees with Clerk', () => {
    const u = { hasImage: true, imageUrl: 'https://img.clerk.com/u' };
    expect(A.avatarSyncValue('https://img.clerk.com/u', u)).toBeUndefined();
    expect(A.avatarSyncValue(null, u)).toBe('https://img.clerk.com/u');
    expect(A.avatarSyncValue('https://img.clerk.com/old', { hasImage: false, imageUrl: 'x' })).toBeNull();
    expect(A.avatarSyncValue(null, { hasImage: false })).toBeUndefined();
    expect(A.avatarSyncValue('https://img.clerk.com/u', null)).toBeUndefined();
  });
});

function fakeUser({ failUpload = false, newUrl = 'https://img.clerk.com/new' } = {}) {
  const user = {
    imageUrl: 'https://img.clerk.com/old',
    hasImage: true,
    setProfileImage: jest.fn(async ({ file }) => {
      if (failUpload) throw new Error('upload failed');
      user.pendingUrl = file === null ? 'https://img.clerk.com/default' : newUrl;
    }),
    reload: jest.fn(async () => {
      user.imageUrl = user.pendingUrl;
    }),
  };
  return user;
}

describe('updateAvatar', () => {
  test('a successful upload patches avatar_url with the Clerk imageUrl', async () => {
    const user = fakeUser();
    const patch = jest.fn(async () => ({ ok: true }));
    const res = await A.updateAvatar({ user, file: 'data:image/jpeg;base64,AAA', patch, previousUrl: 'https://img.clerk.com/old' });
    expect(user.setProfileImage).toHaveBeenCalledWith({ file: 'data:image/jpeg;base64,AAA' });
    expect(patch).toHaveBeenCalledWith({ avatar_url: 'https://img.clerk.com/new' });
    expect(res).toEqual({ ok: true, avatarUrl: 'https://img.clerk.com/new', synced: true });
  });

  test('a remove sets avatar_url to null', async () => {
    const user = fakeUser();
    const patch = jest.fn(async () => ({ ok: true }));
    const res = await A.updateAvatar({ user, file: null, patch, previousUrl: 'https://img.clerk.com/old' });
    expect(user.setProfileImage).toHaveBeenCalledWith({ file: null });
    expect(patch).toHaveBeenCalledWith({ avatar_url: null });
    expect(res.avatarUrl).toBeNull();
    expect(res.ok).toBe(true);
  });

  test('a Clerk upload failure keeps the old photo, reports an error and never patches', async () => {
    const user = fakeUser({ failUpload: true });
    const patch = jest.fn(async () => ({ ok: true }));
    const res = await A.updateAvatar({ user, file: 'data:x', patch, previousUrl: 'https://img.clerk.com/old' });
    expect(res.ok).toBe(false);
    expect(res.stage).toBe('upload');
    expect(res.avatarUrl).toBe('https://img.clerk.com/old');
    expect(patch).not.toHaveBeenCalled();
  });

  test('a failed PATCH still shows the Clerk photo, flagged unsynced', async () => {
    const user = fakeUser();
    const patch = jest.fn(async () => ({ ok: false, status: 500 }));
    const res = await A.updateAvatar({ user, file: 'data:x', patch });
    expect(res).toEqual({ ok: true, avatarUrl: 'https://img.clerk.com/new', synced: false });
    const throwing = jest.fn(async () => { throw new Error('net'); });
    expect((await A.updateAvatar({ user: fakeUser(), file: 'data:x', patch: throwing })).synced).toBe(false);
  });

  test('no Clerk user yet: nothing happens', async () => {
    const patch = jest.fn();
    const res = await A.updateAvatar({ user: null, file: 'data:x', patch, previousUrl: 'u' });
    expect(res).toEqual({ ok: false, stage: 'no_user', avatarUrl: 'u' });
    expect(patch).not.toHaveBeenCalled();
  });
});
