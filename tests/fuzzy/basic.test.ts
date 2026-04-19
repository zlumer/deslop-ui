import { describe, expect, it } from "vitest"
import { equals } from "../../src/fuzzy"

const CODE = [
	`type UserInfoProps = {
	userName: string;
	age: number;
}
const UserInfo: React.FC<UserInfoProps> = ({ userName, age }) => (
	<div className="user-info">
		<h2>{userName}</h2>
		<p>Age: {age}</p>
	</div>
);
export const UserProfile = () =>
{
	const userName: string = "Alice";
	const age: number = 28;
	return (
		<div>
			<UserInfo userName={userName} age={age}/>
		</div>
	)
};`,
	`type UserInfoProps =
{
	userName: string
	age: number
}
const UserInfo: React.FC<UserInfoProps> = ({ userName, age }) =>
	<div className="user-info">
		<h2>{userName}</h2>
		<p>Age: {age}</p>
	</div>
export const UserProfile = () =>
{
	const userName: string = "Alice";
	const age: number = 28;
	return (<div><UserInfo userName={userName} age={age}/></div>)
}`,
	`interface UserInfoProps {
	userName: string;
	age: number,
}

const UserInfo: React.FC<UserInfoProps> = ({ age, userName }) =>
	<div className="user-info">
		<h2>{userName}</h2>
		<p>Age: {age}</p>
	</div>

export const UserProfile = () =>
{
	const userName: string = "Alice";
	const age: number = 28;
	return (<div><UserInfo userName={userName} age={age}/></div>)
}`
]

const ONE_LINERS = [
	`export const HI = () => (<div>HI</div>)`,
	`export const HI = () => (<div>HI</div>);`,
	`export const HI = () => <div>HI</div>;`,
	`export const HI = () => <div>HI</div>`,
]
const ONE_LINERS_2 = [
	`interface UserInfoProps {
	userName: string;
	age: number,
}`,
	`interface UserInfoProps { userName: string; age: number,}`,
	`interface UserInfoProps { userName: string, age: number }`,
	`interface UserInfoProps { userName: string, age: number, }`,
	`interface UserInfoProps { userName: string, age: number; }`,
	`interface UserInfoProps { userName: string; age: number; }`,
	`interface UserInfoProps {userName:string;age:number;}`,
	`type UserInfoProps = {userName:string;age:number;}`,
	`type UserInfoProps = { userName:string, age:number }`,
	`type UserInfoProps = { userName:string, /*age:string*/ age:number }`,
]
const DIFFERENT_2 = [
	`type UserInfoProps = { userName:string }`,
	`type UserInfoProps = { userName:string, age:string }`,
	`type UserInfoProps = { userName:string, ag:number }`,
	`type UserInfoProp = { userName:string, age:number }`,
]
const REACT = [
	`const x: React.FC = () => (<span/>)`,
	`const x: React.FC = () => <span/>`,
	`const x: React.FC = () => <span/>;`,
	`const x: React.FC<{}> = () => (<span/>)`,
	`const x = () => (<span/>)`,
	`const x = () => <span/>`,
	`const x: React.FC = () => (<span></span>)`,
]
const REACT_2 = [
	`const x = () => <div>{/* comment */}</div>`,
	`const x = () => <div>{/* */}</div>`,
	`const x = () => <div></div>`,
	`const x = () => <div/>`,
	`const x = () => <div />`,
]
const REACT_PROPS = [
	`const x: React.FC = (props) => (<span/>)`,
	`const x: React.FC<{}> = (props) => (<span/>)`,
	`const x = (props) => <span/>`,
	`const x = (props) => <span/>`,
	`const x = (props) => <span/>`,
]
const REACT_PROPS_D = [
	`const x: React.FC<{ x: number }> = (props) => (<span/>)`,
	`const x = (props: { y: number }) => <span/>`,
	`const x: React.FC<React.PropsWithChildren> = (props) => (<span/>)`,
]

function matrix<T>(arr1: T[], arr2: T[])
{
	const result: [T, T, number, number][] = []
	for (let i = 0; i < arr1.length; i++)
		for (let j = i + 1; j < arr2.length; j++)
			result.push([arr1[i], arr2[j], i, j])
	return result
}

describe('code fuzzy equal', () =>
{
	it("sanity check 1", () =>
	{
		expect(equals("let x", "let x")).toBe(true)
		expect(equals("let x", "let y")).toBe(false)
		expect(equals("let x: number", "let x: number")).toBe(true)
		expect(equals("let x: number", "let x: number // hi")).toBe(true)
		expect(equals("let x: number", "let x: string")).toBe(false)
		expect(equals(
			`type UserInfoProp = { userName:string, age:number }`,
			`type UserInfoProp = { userName:string, age:number }`
		)).toBe(true)

		expect(equals(
			`type UserInfoProp = { userName:string, age:number }`,
			`type UserInfoProp = { userName:string, age:string }`
		)).toBe(false)

		expect(equals(
			`type UserInfoProp = { userName:string, age:number }`,
			`type UserInfoProp = {userName:string, age:number }`
		)).toBe(true)

		expect(equals(
			`type UserInfoProp = { userName:string, age:number }`,
			`type UserInfoProp = { age:number }`
		)).toBe(false)
	})
	it('code', () =>
	{
		for (let [a,b] of matrix(CODE, CODE))
			if (!equals(a,b))
				expect(a).toBe(b)
	})
	it('one-liners', () =>
	{
		for (let [a,b] of matrix(ONE_LINERS, ONE_LINERS))
			if (!equals(a,b))
				expect(a).toBe(b)
	})
	it('one-liners-2', () =>
	{
		for (let [a,b] of matrix(ONE_LINERS_2, ONE_LINERS_2))
			if (!equals(a,b))
				expect(a).toBe(b)
	})
	it('different code', () =>
	{
		for (let [a,b] of matrix(ONE_LINERS_2, DIFFERENT_2))
			if (equals(a,b))
				console.log(a, "\n", b), expect(a).not.toBe(b)
	})
	it('different code-2', () =>
	{
		for (let [a,b] of matrix(DIFFERENT_2, DIFFERENT_2))
			if (equals(a,b))
				console.log(a, "\n", b), expect(a).not.toBe(b)
	})
	it('react', () =>
	{
		for (let [a,b] of matrix(REACT, REACT))
			if (!equals(a,b))
				expect(a).toBe(b)
	})
	it('react-2', () =>
	{
		for (let [a,b] of matrix(REACT, REACT))
			if (!equals(a,b))
				expect(a).toBe(b)
	})
	it('react-props', () =>
	{
		for (let [a,b] of matrix(REACT_PROPS, REACT_PROPS))
			if (!equals(a,b))
				expect(a).toBe(b)
	})
	it('react-props-different', () =>
	{
		for (let [a,b] of matrix(REACT_PROPS, REACT_PROPS_D))
			if (equals(a,b))
				console.log(a, "\n", b), expect(a).not.toBe(b)
	})
})