import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { API_URL } from '../config';

type AccountRecoveryModalProps = {
  open: boolean;
  onClose: () => void;
};

const AccountRecoveryModal: React.FC<AccountRecoveryModalProps> = ({ open, onClose }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  if (!open) {
    return null;
  }

  const resetAndClose = () => {
    setName('');
    setEmail('');
    setPhone('');
    setMessage('');
    setFormError('');
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName || !trimmedEmail || !trimmedPhone) {
      setFormError('Please enter your name, email, and contact number.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const response = await fetch(`${API_URL}/support/account-recovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          ...(trimmedMessage ? { message: trimmedMessage } : {}),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || 'Could not send your request. Please try again.');
      }

      toast.success(payload?.message || 'We received your request. An admin will contact you shortly.');
      resetAndClose();
    } catch (error: any) {
      const display = error?.message || 'Could not send your request. Please try again.';
      setFormError(display);
      toast.error(display);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" onClick={resetAndClose} />
      <div
        role="dialog"
        aria-labelledby="account-recovery-title"
        className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
      >
        <button
          type="button"
          onClick={resetAndClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Close"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
        <h3 id="account-recovery-title" className="pr-8 text-2xl font-bold text-gray-900">
          Forgot email or password?
        </h3>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Tell us the name, email, and phone number you used when you registered.
          An admin will verify your request and send a temporary password.
        </p>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="recovery-name" className="mb-1.5 block text-sm font-semibold text-gray-700">
              Full name
            </label>
            <input
              id="recovery-name"
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Name used at registration"
            />
          </div>
          <div>
            <label htmlFor="recovery-email" className="mb-1.5 block text-sm font-semibold text-gray-700">
              Email
            </label>
            <input
              id="recovery-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Email used at registration"
            />
          </div>
          <div>
            <label htmlFor="recovery-phone" className="mb-1.5 block text-sm font-semibold text-gray-700">
              Contact number
            </label>
            <input
              id="recovery-phone"
              type="tel"
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Phone number we can reach you on"
            />
          </div>
          <div>
            <label htmlFor="recovery-message" className="mb-1.5 block text-sm font-semibold text-gray-700">
              Message <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              id="recovery-message"
              rows={3}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Anything that helps us find your account"
            />
          </div>

          {formError ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
              {formError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50"
          >
            {submitting ? 'Sending…' : 'Submit request'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AccountRecoveryModal;
