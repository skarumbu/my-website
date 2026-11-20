import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import NavBar from './components/nav-bar.tsx';
import { lookupAddress, PoligraphError } from './lib/poligraphApi.ts';
import { latestTerm } from './lib/poligraphFormat.ts';
import type { LookupResult, Official } from './lib/poligraphTypes.ts';
import './styling/poligraph.css';

const BLANK_MESSAGE = 'Enter a street address.';
const NOT_FOUND_MESSAGE = "We couldn't find that address. Try adding the city and state.";
const UNAVAILABLE_MESSAGE = 'Address lookup is unavailable right now. Try again later.';
const NETWORK_MESSAGE = "Couldn't reach PoliGraph. Check your connection and try again.";

function messageFor(err: unknown): string {
  const code = err instanceof PoligraphError ? err.code : '';
  if (code === 'address_not_found') return NOT_FOUND_MESSAGE;
  if (code === 'bad_parameter') return BLANK_MESSAGE;
  if (code === 'network') return NETWORK_MESSAGE;
  return UNAVAILABLE_MESSAGE;
}

interface AddressFormProps {
  onResult: (result: LookupResult) => void;
}

/** The address lives only in this input's state; it is POSTed once and cleared on success. */
export function AddressForm({ onResult }: AddressFormProps) {
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const trimmed = address.trim();
    if (trimmed === '') {
      setError(BLANK_MESSAGE);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await lookupAddress(trimmed);
      setAddress('');
      setBusy(false);
      onResult(result);
    } catch (err) {
      setError(messageFor(err));
      setBusy(false);
    }
  };

  return (
    <form className="poligraph-address-form" onSubmit={submit} noValidate>
      <label htmlFor="poligraph-address">Your address</label>
      <input
        id="poligraph-address"
        type="text"
        name="address"
        autoComplete="street-address"
        maxLength={200}
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <button type="submit" disabled={busy}>{busy ? 'Looking up…' : 'Find my officials'}</button>
      {error && <p className="poligraph-error" role="alert">{error}</p>}
    </form>
  );
}

function OfficialItem({ official }: { official: Official }) {
  const term = latestTerm(official);
  return (
    <li>
      <Link to={`/poligraph/official/${official.id}`}>
        <span className="poligraph-result-name">{official.name}</span>
        {official.party && <span className="poligraph-result-office"> {official.party}</span>}
        {term && <span className="poligraph-result-office"> {term.title}</span>}
      </Link>
    </li>
  );
}

const PoliGraphLookup: React.FC = () => {
  const location = useLocation();
  const [result, setResult] = useState<LookupResult | null>(
    (location.state as { result?: LookupResult } | null)?.result ?? null,
  );

  return (
    <div className="poligraph-page">
      <NavBar />
      <main className="poligraph-content">
        <h1>Your officials</h1>
        {result && (
          <>
            <section className="poligraph-lookup-group">
              <h2>Federal</h2>
              <ul className="poligraph-results">
                {result.federal.map((o) => <OfficialItem key={o.id} official={o} />)}
              </ul>
            </section>
            <section className="poligraph-lookup-group">
              <h2>State</h2>
              {result.state.length > 0 ? (
                <ul className="poligraph-results">
                  {result.state.map((o) => <OfficialItem key={o.id} official={o} />)}
                </ul>
              ) : (
                <p className="poligraph-note">State officials are coming soon.</p>
              )}
            </section>
          </>
        )}
        <section className="poligraph-find">
          <h2>{result ? 'Look up another address' : 'Find my officials'}</h2>
          <AddressForm onResult={setResult} />
          <p className="poligraph-note">Your address is used once to find your districts and isn't saved.</p>
        </section>
      </main>
    </div>
  );
};

export default PoliGraphLookup;
