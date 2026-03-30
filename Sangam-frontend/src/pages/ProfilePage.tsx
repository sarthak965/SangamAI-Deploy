import type { CurrentUser } from "../types";

export default function ProfilePage({ me }: { me: CurrentUser }) {
  const initial = me.displayName.charAt(0).toUpperCase();

  return (
    <div className="profile-page">
      <div className="page-header">
        <h1>My Profile</h1>
        <p>Your SangamAI account details</p>
      </div>

      <div className="profile-card">
        <div className="profile-avatar">{initial}</div>

        <div className="profile-field">
          <span className="label">Display Name</span>
          <span className="value">{me.displayName}</span>
        </div>
        <div className="profile-field">
          <span className="label">Username</span>
          <span className="value">@{me.username}</span>
        </div>
        <div className="profile-field">
          <span className="label">Email</span>
          <span className="value">{me.email}</span>
        </div>
      </div>
    </div>
  );
}
