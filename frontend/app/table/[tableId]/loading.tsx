export default function Loading() {
	return (
		<div className="min-h-screen bg-gray-50 pb-24">
			<header className="sticky top-0 z-50 bg-white shadow-sm">
				<div className="p-4 border-b flex flex-col items-center gap-2">
					<div className="w-48 h-6 bg-gray-200 rounded animate-pulse" />
					<div className="w-24 h-4 bg-gray-200 rounded animate-pulse" />
				</div>
				<div className="flex gap-4 p-4 border-b overflow-hidden">
					{[1, 2, 3, 4, 5].map((i) => (
						<div key={i} className="w-24 h-10 bg-gray-200 rounded-full flex-shrink-0 animate-pulse" />
					))}
				</div>
			</header>

			<main className="p-4 space-y-8">
				{[1, 2].map((section) => (
					<section key={section}>
						<div className="w-32 h-8 bg-gray-200 rounded mb-4 animate-pulse" />
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{[1, 2, 3, 4].map((item) => (
								<div key={item} className="flex gap-4 p-4 bg-white rounded-xl shadow-sm border border-gray-100">
									<div className="w-24 h-24 bg-gray-200 rounded-lg flex-shrink-0 animate-pulse" />
									<div className="flex flex-col flex-grow justify-between py-1">
										<div className="space-y-2">
											<div className="w-3/4 h-5 bg-gray-200 rounded animate-pulse" />
											<div className="w-full h-3 bg-gray-200 rounded animate-pulse" />
											<div className="w-2/3 h-3 bg-gray-200 rounded animate-pulse" />
										</div>
										<div className="w-1/3 h-5 bg-gray-200 rounded animate-pulse mt-2" />
									</div>
								</div>
							))}
						</div>
					</section>
				))}
			</main>
		</div>
	);
}